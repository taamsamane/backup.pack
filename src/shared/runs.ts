import { z } from 'zod'

export const TaskRunIdSchema = z.object({
  id: z.string().uuid()
})

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

export const RunProgressSchema = z.object({
  runId: z.string().uuid(),
  taskId: z.string().uuid(),
  taskName: z.string().nullable(),
  status: z.string(),
  /** 0–100 */
  percent: z.number().min(0).max(100),
  phase: z.string(),
  message: z.string(),
  bytesTotal: z.number().nullable().optional(),
  fileCount: z.number().nullable().optional(),
  at: z.string()
})

export type RunProgress = z.infer<typeof RunProgressSchema>

export const RunLogResponseSchema = z.object({
  runId: z.string().uuid(),
  logPath: z.string().nullable(),
  content: z.string(),
  exists: z.boolean()
})

export type RunLogResponse = z.infer<typeof RunLogResponseSchema>
