import { BrowserWindow } from 'electron'
import { IpcChannels } from '../../shared/ipc/channels'
import type { RunProgress } from '../../shared/runs'

const latest = new Map<string, RunProgress>()

export function emitRunProgress(progress: RunProgress): void {
  latest.set(progress.runId, progress)
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send(IpcChannels.TASKS_RUN_PROGRESS, progress)
  }
}

export function getLatestRunProgress(runId: string): RunProgress | null {
  return latest.get(runId) ?? null
}

export function clearRunProgress(runId: string): void {
  latest.delete(runId)
}
