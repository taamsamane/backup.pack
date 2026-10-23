import { accessSync, constants, mkdirSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import { eq } from 'drizzle-orm'
import { planBackupRun } from '../../shared/backup/planner'
import { selectCyclesToPrune } from '../../shared/backup/retention'
import type { BackupPlan } from '../../shared/backup/types'
import { ProfileOptionsSchema } from '../../shared/profiles'
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
import { claimPendingRun, finishRun } from './runsRepo'
import { adapterUnavailableMessage, getSourceAdapter } from './sources'
import { transferFromSource } from './transfer'

function assertTargetWritable(targetFolder: string): void {
  mkdirSync(targetFolder, { recursive: true })
  accessSync(targetFolder, constants.W_OK)
}

function writeRunLog(runId: string, lines: string[]): string {
  const dir = join(app.getPath('userData'), 'logs', 'runs')
  mkdirSync(dir, { recursive: true })
  const logPath = join(dir, `${runId}.log`)
  writeFileSync(logPath, `${lines.join('\n')}\n`, 'utf8')
  return logPath
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

/**
 * Execute one claimed run.
 * - dryRun: validate target + plan (+ adapter presence); no downloads.
 * - real: SFTP/FTP/SSH transfer into cycle layout; other types wait for later phases.
 */
export async function executeRun(runId: string): Promise<void> {
  const log = getLogger('engine')
  const claimed = claimPendingRun(runId)
  if (!claimed) {
    return
  }

  const startedAt = claimed.startedAt ?? new Date().toISOString()
  const lines: string[] = [`runId=${runId}`, `dryRun=${claimed.dryRun}`, `startedAt=${startedAt}`]

  try {
    const task = getOrm().select().from(tasks).where(eq(tasks.id, claimed.taskId)).get()
    if (!task) {
      throw new Error('Task not found')
    }
    const profile = loadResolvedProfile(task.profileId)
    const { settings, archivePasswordEncrypted } = parseTaskSettings(task.settingsJson)
    const archivePassword = loadArchivePassword(archivePasswordEncrypted)
    const now = new Date()
    const active = getActiveCycle(task.id)
    const plan = planBackupRun({ settings, activeCycle: active, now })
    lines.push(...describePlan(plan))
    lines.push(`profileType=${profile.type}`, `target=${task.targetFolder}`)

    assertTargetWritable(task.targetFolder)
    const taskRoot = taskRootPath(task.targetFolder, task.name)
    ensureTaskLayout(taskRoot)
    lines.push(`taskRoot=${taskRoot}`)

    const adapter = getSourceAdapter(profile.type)

    if (claimed.dryRun) {
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
            adapter: adapter?.kind ?? null,
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
      lines.push(
        `planSnapshot=${planPath}`,
        adapter
          ? `adapter=${adapter.kind} ready`
          : adapterUnavailableMessage(profile.type),
        'Dry-run OK — no files downloaded'
      )
      const logPath = writeRunLog(runId, lines)
      finishRun({
        runId,
        status: 'dry_run',
        startedAt,
        logPath,
        fileCount: 0,
        bytesTotal: 0,
        errorMessage: null
      })
      log.info({ runId, taskId: task.id }, 'Dry-run completed')
      return
    }

    if (!adapter) {
      const message = adapterUnavailableMessage(profile.type)
      const logPath = writeRunLog(runId, [...lines, message])
      finishRun({
        runId,
        status: 'failed',
        startedAt,
        logPath,
        errorMessage: message
      })
      return
    }

    let workingCycleId: string | null = active?.id ?? null
    let bytesTotal = 0
    let fileCount = 0

    if (plan.cycleToFinalize) {
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
      lines.push(
        `finalized=${plan.cycleToFinalize.folderName}`,
        `archive=${fin.archivePath ?? 'none'}`
      )
      workingCycleId = null
    }

    let transferMode: 'baseline' | 'changes' = 'baseline'
    let cycleFolderName: string

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
      lines.push(`createdCycle=${cycleFolderName}`)
    } else if (plan.action === 'changes' && plan.activeCycle) {
      workingCycleId = plan.activeCycle.id
      cycleFolderName = plan.activeCycle.folderName
      transferMode = 'changes'
      ensureCycleDirs(taskRoot, cycleFolderName)
    } else {
      throw new Error(`Cannot execute plan action ${plan.action} without a cycle`)
    }

    const transfer = await transferFromSource({
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
    lines.push(...transfer.lines)

    applyRetention(task.id, settings.retention?.keepCycles, taskRoot)

    const logPath = writeRunLog(runId, [...lines, 'Backup transfer completed'])
    finishRun({
      runId,
      status: 'success',
      startedAt,
      cycleId: workingCycleId,
      bytesTotal,
      fileCount,
      logPath,
      errorMessage: null
    })
    log.info(
      { runId, taskId: task.id, profileType: profile.type, fileCount, bytesTotal },
      'Run succeeded'
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    lines.push(`ERROR ${message}`)
    let logPath: string | null = null
    try {
      logPath = writeRunLog(runId, lines)
    } catch {
      // ignore
    }
    finishRun({
      runId,
      status: 'failed',
      startedAt,
      errorMessage: message,
      logPath
    })
    log.error({ runId, err: message }, 'Run failed')
  }
}
