import { z } from 'zod'

export const RestoreListCyclesSchema = z.object({
  taskId: z.string().uuid()
})

export const RestoreBrowseSchema = z.object({
  cycleId: z.string().uuid(),
  /** Optional change stamp; omit = latest (baseline + all changes). */
  asOfStamp: z.string().min(1).max(64).optional()
})

export const RestoreFilesSchema = z.object({
  cycleId: z.string().uuid(),
  destPath: z.string().min(1).max(4096),
  asOfStamp: z.string().min(1).max(64).optional(),
  /** When set, only these relative paths are restored. */
  paths: z.array(z.string().min(1).max(4096)).max(10_000).optional()
})

export const RestoreVerifySchema = z.object({
  cycleId: z.string().uuid()
})

export const CycleRestoreDtoSchema = z.object({
  id: z.string().uuid(),
  taskId: z.string().uuid(),
  taskName: z.string(),
  folderName: z.string(),
  startedAt: z.string(),
  endedAt: z.string().nullable(),
  status: z.string(),
  archivePath: z.string().nullable(),
  hasUnzippedCycle: z.boolean(),
  hasArchive: z.boolean()
})

export type CycleRestoreDto = z.infer<typeof CycleRestoreDtoSchema>

export const RestoreBrowseEntrySchema = z.object({
  path: z.string(),
  size: z.number().nullable(),
  source: z.enum(['baseline', 'changes']),
  changeStamp: z.string().nullable()
})

export type RestoreBrowseEntry = z.infer<typeof RestoreBrowseEntrySchema>

export const RestoreBrowseResultSchema = z.object({
  cycleId: z.string().uuid(),
  folderName: z.string(),
  asOfStamp: z.string().nullable(),
  changeStamps: z.array(z.string()),
  entries: z.array(RestoreBrowseEntrySchema),
  deletedPaths: z.array(z.string()),
  materializedFromArchive: z.boolean()
})

export type RestoreBrowseResult = z.infer<typeof RestoreBrowseResultSchema>

export const RestoreFilesResultSchema = z.object({
  ok: z.literal(true),
  destPath: z.string(),
  fileCount: z.number().int().nonnegative(),
  bytesTotal: z.number().int().nonnegative(),
  deletedSkipped: z.number().int().nonnegative()
})

export type RestoreFilesResult = z.infer<typeof RestoreFilesResultSchema>

export const RestoreVerifyResultSchema = z.object({
  ok: z.boolean(),
  archivePath: z.string().nullable(),
  bytes: z.number().nullable(),
  entryCount: z.number().nullable(),
  errors: z.array(z.string())
})

export type RestoreVerifyResult = z.infer<typeof RestoreVerifyResultSchema>
