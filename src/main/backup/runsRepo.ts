import { asc, desc, eq } from 'drizzle-orm'
import { z } from 'zod'
import { getOrm } from '../db/client'
import { taskRuns, tasks } from '../db/schema'

export const TaskRunDtoSchema = z.object({
  id: z.string().uuid(),
  taskId: z.string().uuid(),
  taskName: z.string().nullable(),
  cycleId: z.string().uuid().nullable(),
  status: z.string(),
  startedAt: z.string().nullable(),
  finishedAt: z.string().nullable(),
  durationMs: z.number().nullable(),
  bytesTotal: z.number().nullable(),
  fileCount: z.number().nullable(),
  errorMessage: z.string().nullable(),
  logPath: z.string().nullable(),
  dryRun: z.boolean(),
  createdAt: z.string()
})

export type TaskRunDto = z.infer<typeof TaskRunDtoSchema>

export function listRecentRuns(limit = 100): TaskRunDto[] {
  const rows = getOrm()
    .select()
    .from(taskRuns)
    .orderBy(desc(taskRuns.createdAt))
    .limit(limit)
    .all()

  return rows.map((row) => {
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
  })
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
