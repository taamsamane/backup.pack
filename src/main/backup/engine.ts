import { accessSync, constants, mkdirSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'
import { eq } from 'drizzle-orm'
import { planBackupRun } from '../../shared/backup/planner'
import { selectCyclesToPrune } from '../../shared/backup/retention'
import type { BackupPlan } from '../../shared/backup/types'
import { ProfileOptionsSchema } from '../../shared/profiles'
import type { RunProgress } from '../../shared/runs'
import { getOrm } from '../db/client'
import { profiles, tasks } from '../db/schema'
import { getLogger } from '../logging/logger'
import { decryptCredentials } from '../security/secrets'
import type { ResolvedProfile } from '../profiles/testers/types'
import { loadArchivePassword, parseTaskSettings } from '../tasks/settingsStorage'
import { archiveFileName, archivePathFor, zipCycleFolder } from './archive'
import {
  archivesDir,
  baselineDir,
  changesDir,
  cycleDir,
  ensureTaskLayout,
  taskRootPath
} from './layout'
import {
  createActiveCycle,
  deleteCycleRow,
  getActiveCycle,
  listCyclesForTask,
  markCycleArchived,
  markCycleFinalizing
} from './cyclesRepo'
import { isDatabaseProfileType } from './db/dump'
import { transferDatabaseDump } from './dbTransfer'
import { openRunLog } from './runLog'
import { clearRunProgress, emitRunProgress } from './runProgress'
import { claimPendingRun, finishRun } from './runsRepo'
import { adapterUnavailableMessage, getSourceAdapter, supportsBackupSource } from './sources'
import { transferFromSource } from './transfer'

function assertTargetWritable(targetFolder: string): void {
  mkdirSync(targetFolder, { recursive: true })
  accessSync(targetFolder, constants.W_OK)
}

function loadResolvedProfile(profileId: string): ResolvedProfile {
  const row = getOrm().select().from(profiles).where(eq(profiles.id, profileId)).get()
  if (!row) {
    throw new Error('Source profile not found')
  }
  return {
    type: row.type,
    name: row.name,
    host: row.host,
    port: row.port,
    username: row.username,
    authMethod: row.authMethod,
    credentials: decryptCredentials(row.credentialsEncrypted),
    options: ProfileOptionsSchema.parse(JSON.parse(row.optionsJson || '{}'))
  }
}

async function finalizeCycle(input: {
  taskName: string
  taskRoot: string
  cycleId: string
  folderName: string
  startedAt: string
  compress: boolean
  archivePassword: string | null
  now: Date
}): Promise<{ archivePath: string | null; bytes: number; fileCount: number }> {
  markCycleFinalizing(input.cycleId)
  const cyclePath = cycleDir(input.taskRoot, input.folderName)
  let archivePath: string | null = null
  let bytes = 0
  let fileCount = 0

  if (input.compress) {
    const endedAt = input.now.toISOString()
    const name = archiveFileName(input.taskName, input.startedAt, endedAt)
    archivePath = archivePathFor(archivesDir(input.taskRoot), name)
    const zipped = await zipCycleFolder({
      cyclePath,
      archivePath,
      password: input.archivePassword
    })
    bytes = zipped.bytes
    fileCount = zipped.fileCount
    rmSync(cyclePath, { recursive: true, force: true })
  }

  markCycleArchived({
    cycleId: input.cycleId,
    endedAt: input.now.toISOString(),
    archivePath
  })
  return { archivePath, bytes, fileCount }
}

function applyRetention(taskId: string, keepCycles: number | undefined, taskRoot: string): void {
  if (!keepCycles) {
    return
  }
  const all = listCyclesForTask(taskId)
  const pruneIds = selectCyclesToPrune(
    all.map((c) => ({ id: c.id, startedAt: c.startedAt, status: c.status })),
    keepCycles
  )
  for (const id of pruneIds) {
    const row = all.find((c) => c.id === id)
    if (!row) {
      continue
    }
    if (row.archivePath) {
      try {
        rmSync(row.archivePath, { force: true })
      } catch {
        // ignore
      }
    } else {
      try {
        rmSync(cycleDir(taskRoot, row.folderName), { recursive: true, force: true })
      } catch {
        // ignore
      }
    }
    deleteCycleRow(id)
  }
}

function describePlan(plan: BackupPlan): string[] {
  return [
    `action=${plan.action}`,
    `reason=${plan.reason}`,
    `activeCycle=${plan.activeCycle?.folderName ?? 'none'}`,
    `finalize=${plan.cycleToFinalize?.folderName ?? 'none'}`,
    `newCycle=${plan.newCycleFolderName ?? 'none'}`,
    `fullBackup=${plan.settings.fullBackup}`,
    `fullPeriod=${
      plan.settings.fullPeriod
        ? `${plan.settings.fullPeriod.value}${plan.settings.fullPeriod.unit}`
        : 'none'
    }`,
    `compress=${plan.settings.compress}`
  ]
}

function ensureCycleDirs(taskRoot: string, folderName: string): void {
  const cPath = cycleDir(taskRoot, folderName)
  mkdirSync(baselineDir(cPath), { recursive: true })
  mkdirSync(changesDir(cPath), { recursive: true })
}

function progress(
  runId: string,
  taskId: string,
  taskName: string | null,
  status: string,
  percent: number,
  phase: string,
  message: string,
  extra?: { bytesTotal?: number | null; fileCount?: number | null }
): void {
  const payload: RunProgress = {
    runId,
    taskId,
    taskName,
    status,
    percent: Math.max(0, Math.min(100, Math.round(percent))),
    phase,
    message,
    bytesTotal: extra?.bytesTotal ?? null,
    fileCount: extra?.fileCount ?? null,
    at: new Date().toISOString()
  }
  emitRunProgress(payload)
}

/**
 * Execute one claimed run with live log + progress events for History.
 */
export async function executeRun(runId: string): Promise<void> {
  const log = getLogger('engine')
  const claimed = claimPendingRun(runId)
  if (!claimed) {
    return
  }

  const startedAt = claimed.startedAt ?? new Date().toISOString()
  const session = openRunLog(runId)
  let taskId = claimed.taskId
  let taskName: string | null = null

  const note = (line: string): void => {
    session.append(line)
  }

  note(`runId=${runId}`)
  note(`dryRun=${claimed.dryRun}`)
  note(`startedAt=${startedAt}`)

  try {
    const task = getOrm().select().from(tasks).where(eq(tasks.id, claimed.taskId)).get()
    if (!task) {
      throw new Error('Task not found')
    }
    taskId = task.id
    taskName = task.name

    progress(runId, taskId, taskName, 'running', 5, 'start', 'Run claimed')

    const profile = loadResolvedProfile(task.profileId)
    const { settings, archivePasswordEncrypted } = parseTaskSettings(task.settingsJson)
    const archivePassword = loadArchivePassword(archivePasswordEncrypted)
    const now = new Date()
    const active = getActiveCycle(task.id)

    progress(runId, taskId, taskName, 'running', 15, 'plan', 'Planning backup action')
    const plan = planBackupRun({ settings, activeCycle: active, now })
    for (const line of describePlan(plan)) {
      note(line)
    }
    note(`profileType=${profile.type}`)
    note(`target=${task.targetFolder}`)

    assertTargetWritable(task.targetFolder)
    const taskRoot = taskRootPath(task.targetFolder, task.name)
    ensureTaskLayout(taskRoot)
    note(`taskRoot=${taskRoot}`)

    const fileAdapter = getSourceAdapter(profile.type)
    const isDb = isDatabaseProfileType(profile.type)

    if (claimed.dryRun) {
      progress(runId, taskId, taskName, 'running', 60, 'dry-run', 'Writing dry-run plan')
      const planPath = join(taskRoot, '.backuphub-last-dry-run.json')
      writeFileSync(
        planPath,
        `${JSON.stringify(
          {
            at: now.toISOString(),
            runId,
            action: plan.action,
            reason: plan.reason,
            profileType: profile.type,
            remotePath: profile.options.remotePath ?? '.',
            adapter: isDb ? `db:${profile.type}` : (fileAdapter?.kind ?? null),
            settings: {
              fullBackup: settings.fullBackup,
              fullPeriod: settings.fullPeriod ?? null,
              compress: settings.compress,
              encryptArchive: settings.encryptArchive
            }
          },
          null,
          2
        )}\n`,
        'utf8'
      )
      note(`planSnapshot=${planPath}`)
      note(
        supportsBackupSource(profile.type)
          ? `adapter=${isDb ? `db:${profile.type}` : fileAdapter?.kind} ready`
          : adapterUnavailableMessage(profile.type)
      )
      note('Dry-run OK — no data transferred')
      finishRun({
        runId,
        status: 'dry_run',
        startedAt,
        logPath: session.path,
        fileCount: 0,
        bytesTotal: 0,
        errorMessage: null
      })
      progress(runId, taskId, taskName, 'dry_run', 100, 'done', 'Dry-run completed')
      log.info({ runId, taskId: task.id }, 'Dry-run completed')
      return
    }

    if (!supportsBackupSource(profile.type)) {
      const message = adapterUnavailableMessage(profile.type)
      note(message)
      finishRun({
        runId,
        status: 'failed',
        startedAt,
        logPath: session.path,
        errorMessage: message
      })
      progress(runId, taskId, taskName, 'failed', 100, 'error', message)
      return
    }

    let workingCycleId: string | null = active?.id ?? null
    let bytesTotal = 0
    let fileCount = 0

    if (plan.cycleToFinalize) {
      progress(runId, taskId, taskName, 'running', 25, 'finalize', 'Finalizing previous cycle')
      const fin = await finalizeCycle({
        taskName: task.name,
        taskRoot,
        cycleId: plan.cycleToFinalize.id,
        folderName: plan.cycleToFinalize.folderName,
        startedAt: plan.cycleToFinalize.startedAt,
        compress: settings.compress,
        archivePassword,
        now
      })
      bytesTotal += fin.bytes
      fileCount += fin.fileCount
      note(`finalized=${plan.cycleToFinalize.folderName}`)
      note(`archive=${fin.archivePath ?? 'none'}`)
      workingCycleId = null
    }

    let transferMode: 'baseline' | 'changes' = 'baseline'
    let cycleFolderName: string

    progress(runId, taskId, taskName, 'running', 35, 'cycle', 'Preparing cycle folders')
    if (
      plan.action === 'baseline' ||
      plan.action === 'full_every_run' ||
      plan.action === 'rollover_then_baseline'
    ) {
      if (!plan.newCycleFolderName) {
        throw new Error('Planner did not provide newCycleFolderName')
      }
      const created = createActiveCycle({
        taskId: task.id,
        folderName: plan.newCycleFolderName,
        startedAt: now.toISOString()
      })
      workingCycleId = created.id
      cycleFolderName = created.folderName
      transferMode = 'baseline'
      ensureCycleDirs(taskRoot, cycleFolderName)
      note(`createdCycle=${cycleFolderName}`)
    } else if (plan.action === 'changes' && plan.activeCycle) {
      workingCycleId = plan.activeCycle.id
      cycleFolderName = plan.activeCycle.folderName
      transferMode = 'changes'
      ensureCycleDirs(taskRoot, cycleFolderName)
    } else {
      throw new Error(`Cannot execute plan action ${plan.action} without a cycle`)
    }

    progress(
      runId,
      taskId,
      taskName,
      'running',
      45,
      'transfer',
      isDb ? 'Dumping database…' : 'Transferring files…'
    )
    note(isDb ? 'Starting database dump…' : 'Starting file transfer…')

    const transfer = isDb
      ? await transferDatabaseDump({
          profile,
          taskRoot,
          cycleFolderName,
          now,
          mode: transferMode
        })
      : await transferFromSource({
          profile,
          plan,
          taskRoot,
          cycleFolderName,
          excludePatterns: settings.excludePatterns ?? [],
          now,
          mode: transferMode
        })
    bytesTotal += transfer.bytes
    fileCount += transfer.fileCount
    for (const line of transfer.lines) {
      note(line)
    }

    progress(
      runId,
      taskId,
      taskName,
      'running',
      90,
      'retention',
      'Applying retention',
      { bytesTotal, fileCount }
    )
    applyRetention(task.id, settings.retention?.keepCycles, taskRoot)

    note('Backup transfer completed')
    finishRun({
      runId,
      status: 'success',
      startedAt,
      cycleId: workingCycleId,
      bytesTotal,
      fileCount,
      logPath: session.path,
      errorMessage: null
    })
    progress(runId, taskId, taskName, 'success', 100, 'done', 'Backup completed', {
      bytesTotal,
      fileCount
    })
    log.info(
      { runId, taskId: task.id, profileType: profile.type, fileCount, bytesTotal },
      'Run succeeded'
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    note(`ERROR ${message}`)
    finishRun({
      runId,
      status: 'failed',
      startedAt,
      errorMessage: message,
      logPath: session.path
    })
    progress(runId, taskId, taskName, 'failed', 100, 'error', message)
    log.error({ runId, err: message }, 'Run failed')
  } finally {
    // Keep last progress snapshot for History until a later clear; optional cleanup:
    setTimeout(() => clearRunProgress(runId), 60_000)
  }
}
