import { existsSync } from 'fs'
import {
  buildPointInTimeSnapshot,
  restoreSnapshotToFolder
} from '../../shared/backup/pointInTime'
import type {
  CycleRestoreDto,
  RestoreBrowseResult,
  RestoreFilesResult,
  RestoreVerifyResult
} from '../../shared/restore'
import { unzipCycleArchive, verifyZipArchive } from './archive'
import { getCycleById, listCyclesForTask } from './cyclesRepo'
import { cycleDir, taskRootPath } from './layout'
import { getTaskDto, getTaskRow } from '../tasks/repository'

function resolveTaskRoot(taskId: string): { taskName: string; taskRoot: string } {
  const task = getTaskRow(taskId)
  if (!task) {
    throw new Error('Task not found')
  }
  return {
    taskName: task.name,
    taskRoot: taskRootPath(task.targetFolder, task.name)
  }
}

async function ensureCycleMaterialized(input: {
  taskRoot: string
  folderName: string
  archivePath: string | null
}): Promise<{ cyclePath: string; materializedFromArchive: boolean }> {
  const cyclePath = cycleDir(input.taskRoot, input.folderName)
  if (existsSync(cyclePath)) {
    return { cyclePath, materializedFromArchive: false }
  }
  if (!input.archivePath || !existsSync(input.archivePath)) {
    throw new Error(
      'Cycle folder is missing and no archive is available. Re-run a backup or restore the archive file.'
    )
  }
  await unzipCycleArchive(input.archivePath, cyclePath)
  return { cyclePath, materializedFromArchive: true }
}

export function listCyclesForRestore(taskId: string): CycleRestoreDto[] {
  const task = getTaskDto(taskId)
  if (!task) {
    throw new Error('Task not found')
  }
  const { taskRoot } = resolveTaskRoot(taskId)
  return listCyclesForTask(taskId).map((row) => {
    const path = cycleDir(taskRoot, row.folderName)
    const hasArchive = Boolean(row.archivePath && existsSync(row.archivePath))
    return {
      id: row.id,
      taskId: row.taskId,
      taskName: task.name,
      folderName: row.folderName,
      startedAt: row.startedAt,
      endedAt: row.endedAt,
      status: row.status,
      archivePath: row.archivePath,
      hasUnzippedCycle: existsSync(path),
      hasArchive
    }
  })
}

export async function browseCycleRestore(input: {
  cycleId: string
  asOfStamp?: string
}): Promise<RestoreBrowseResult> {
  const row = getCycleById(input.cycleId)
  if (!row) {
    throw new Error('Cycle not found')
  }
  const { taskRoot } = resolveTaskRoot(row.taskId)
  const { cyclePath, materializedFromArchive } = await ensureCycleMaterialized({
    taskRoot,
    folderName: row.folderName,
    archivePath: row.archivePath
  })
  const snapshot = buildPointInTimeSnapshot(cyclePath, input.asOfStamp ?? null)
  return {
    cycleId: row.id,
    folderName: row.folderName,
    asOfStamp: snapshot.asOfStamp,
    changeStamps: snapshot.changeStamps,
    entries: snapshot.files.map((f) => ({
      path: f.path,
      size: f.size,
      source: f.source,
      changeStamp: f.changeStamp
    })),
    deletedPaths: snapshot.deletedPaths,
    materializedFromArchive
  }
}

export async function restoreCycleFiles(input: {
  cycleId: string
  destPath: string
  asOfStamp?: string
  paths?: string[]
}): Promise<RestoreFilesResult> {
  const row = getCycleById(input.cycleId)
  if (!row) {
    throw new Error('Cycle not found')
  }
  const { taskRoot } = resolveTaskRoot(row.taskId)
  const { cyclePath } = await ensureCycleMaterialized({
    taskRoot,
    folderName: row.folderName,
    archivePath: row.archivePath
  })
  const snapshot = buildPointInTimeSnapshot(cyclePath, input.asOfStamp ?? null)
  const result = restoreSnapshotToFolder({
    snapshot,
    destRoot: input.destPath,
    paths: input.paths ?? null
  })
  return {
    ok: true,
    destPath: input.destPath,
    fileCount: result.fileCount,
    bytesTotal: result.bytesTotal,
    deletedSkipped: result.deletedSkipped
  }
}

export async function verifyCycleArchive(cycleId: string): Promise<RestoreVerifyResult> {
  const row = getCycleById(cycleId)
  if (!row) {
    throw new Error('Cycle not found')
  }
  if (!row.archivePath) {
    return {
      ok: false,
      archivePath: null,
      bytes: null,
      entryCount: null,
      errors: ['This cycle has no archive zip (still active or compression was off).']
    }
  }
  const verified = await verifyZipArchive(row.archivePath)
  return {
    ok: verified.ok,
    archivePath: row.archivePath,
    bytes: verified.bytes,
    entryCount: verified.entryCount,
    errors: verified.errors
  }
}
