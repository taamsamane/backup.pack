import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import { BrowserWindow } from 'electron'
import { IpcChannels } from '../../shared/ipc/channels'

export function runLogPath(runId: string): string {
  const dir = join(app.getPath('userData'), 'logs', 'runs')
  mkdirSync(dir, { recursive: true })
  return join(dir, `${runId}.log`)
}

export type RunLogSession = {
  path: string
  append: (line: string) => void
  appendLines: (lines: string[]) => void
}

/**
 * Create/append a run log and push each line to the renderer as a terminal stream.
 */
export function openRunLog(runId: string): RunLogSession {
  const path = runLogPath(runId)
  if (!existsSync(path)) {
    writeFileSync(path, '', 'utf8')
  }

  const append = (line: string): void => {
    const text = line.endsWith('\n') ? line : `${line}\n`
    appendFileSync(path, text, 'utf8')
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send(IpcChannels.TASKS_RUN_LOG_LINE, {
        runId,
        line: line.replace(/\n$/, ''),
        at: new Date().toISOString()
      })
    }
  }

  return {
    path,
    append,
    appendLines: (lines) => {
      for (const line of lines) {
        append(line)
      }
    }
  }
}

export function readRunLog(runId: string): { path: string | null; content: string; exists: boolean } {
  const path = runLogPath(runId)
  if (!existsSync(path)) {
    return { path: null, content: '', exists: false }
  }
  return {
    path,
    content: readFileSync(path, 'utf8'),
    exists: true
  }
}
