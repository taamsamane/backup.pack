import { getAllSettingsFromDb } from '../db/database'
import { getLogger } from '../logging/logger'
import { executeRun } from './engine'
import { listPendingRunIds } from './runsRepo'

let timer: ReturnType<typeof setInterval> | null = null
let pumping = false
const inFlight = new Set<string>()

async function pump(): Promise<void> {
  if (pumping) {
    return
  }
  pumping = true
  try {
    const concurrency = getAllSettingsFromDb().globalConcurrency
    const pending = listPendingRunIds().filter((id) => !inFlight.has(id))
    const slots = Math.max(0, concurrency - inFlight.size)
    const batch = pending.slice(0, slots)

    await Promise.all(
      batch.map(async (runId) => {
        inFlight.add(runId)
        try {
          await executeRun(runId)
        } catch (error) {
          getLogger('worker').error(
            { runId, err: error instanceof Error ? error.message : String(error) },
            'Unhandled engine error'
          )
        } finally {
          inFlight.delete(runId)
        }
      })
    )
  } finally {
    pumping = false
  }
}

export function notifyRunQueued(): void {
  void pump()
}

export function startBackupWorker(): void {
  if (timer) {
    return
  }
  timer = setInterval(() => {
    void pump()
  }, 2000)
  void pump()
  getLogger('worker').info('Backup worker started')
}

export function stopBackupWorker(): void {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
  getLogger('worker').info('Backup worker stopped')
}
