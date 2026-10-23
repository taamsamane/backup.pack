import { asc, desc, eq } from 'drizzle-orm'
import type { TaskRunDto } from '../../shared/runs'
import { getOrm } from '../db/client'
import { taskRuns, tasks } from '../db/schema'

function toDto(row: typeof taskRuns.$inferSelect): TaskRunDto {
  const task = getOrm().select().from(tasks).where(eq(tasks.id, row.taskId)).get()
  return {
    id: row.id,
    taskId: row.taskId,
    taskName: task?.name ?? null,
    cycleId: row.cycleId,
    status: row.status,
    startedAt: row.startedAt,
    finishedAt: row.finishedAt,
    durationMs: row.durationMs,
    bytesTotal: row.bytesTotal,
    fileCount: row.fileCount,
    errorMessage: row.errorMessage,
    logPath: row.logPath,
    dryRun: row.dryRun,
    createdAt: row.createdAt
  }
}

export function listRecentRuns(limit = 100): TaskRunDto[] {
  return getOrm()
    .select()
    .from(taskRuns)
    .orderBy(desc(taskRuns.createdAt))
    .limit(limit)
    .all()
    .map(toDto)
}

export function getRunDto(id: string): TaskRunDto | null {
  const row = getOrm().select().from(taskRuns).where(eq(taskRuns.id, id)).get()
  return row ? toDto(row) : null
}

export function claimPendingRun(runId: string): typeof taskRuns.$inferSelect | null {
  const row = getOrm().select().from(taskRuns).where(eq(taskRuns.id, runId)).get()
  if (!row || row.status !== 'pending') {
    return null
  }
  const startedAt = new Date().toISOString()
  getOrm()
    .update(taskRuns)
    .set({ status: 'running', startedAt, errorMessage: null })
    .where(eq(taskRuns.id, runId))
    .run()
  return getOrm().select().from(taskRuns).where(eq(taskRuns.id, runId)).get() ?? null
}

export function listPendingRunIds(): string[] {
  return getOrm()
    .select()
    .from(taskRuns)
    .where(eq(taskRuns.status, 'pending'))
    .orderBy(asc(taskRuns.createdAt))
    .all()
    .map((r) => r.id)
}

export function finishRun(input: {
  runId: string
  status: 'success' | 'failed' | 'cancelled' | 'dry_run'
  cycleId?: string | null
  bytesTotal?: number | null
  fileCount?: number | null
  errorMessage?: string | null
  logPath?: string | null
  startedAt: string
}): void {
  const finishedAt = new Date().toISOString()
  const durationMs = Math.max(0, Date.parse(finishedAt) - Date.parse(input.startedAt))
  getOrm()
    .update(taskRuns)
    .set({
      status: input.status,
      finishedAt,
      durationMs,
      cycleId: input.cycleId ?? null,
      bytesTotal: input.bytesTotal ?? null,
      fileCount: input.fileCount ?? null,
      errorMessage: input.errorMessage ?? null,
      logPath: input.logPath ?? null
    })
    .where(eq(taskRuns.id, input.runId))
    .run()
}
