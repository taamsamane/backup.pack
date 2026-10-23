import { z } from 'zod'

export const ScheduleModeSchema = z.enum(['every', 'daily', 'weekly', 'monthly', 'cron'])
export type ScheduleMode = z.infer<typeof ScheduleModeSchema>

export const EveryUnitSchema = z.enum(['minute', 'hour'])
export const FullPeriodUnitSchema = z.enum(['day', 'week', 'month'])

/**
 * Schedule = WHEN the task runs. cronExpression is always stored as the executable form;
 * mode + fields are kept so the wizard can round-trip edits.
 */
export const TaskScheduleSchema = z
  .object({
    timezone: z.string().min(1).max(64),
    mode: ScheduleModeSchema,
    /** Filled by normalizeSchedule for wizard modes; required for mode=cron. */
    cronExpression: z.string().trim().max(200).default(''),
    everyValue: z.number().int().min(1).max(10_000).optional(),
    everyUnit: EveryUnitSchema.optional(),
    hour: z.number().int().min(0).max(23).optional(),
    minute: z.number().int().min(0).max(59).optional(),
    /** 0 = Sunday … 6 = Saturday (croner / standard). */
    daysOfWeek: z.array(z.number().int().min(0).max(6)).min(1).optional(),
    dayOfMonth: z.number().int().min(1).max(31).optional()
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.mode === 'cron' && !value.cronExpression.trim()) {
      ctx.addIssue({
        code: 'custom',
        message: 'cronExpression is required for cron-mode schedules',
        path: ['cronExpression']
      })
    }
    if (value.mode === 'every') {
      if (!value.everyValue || !value.everyUnit) {
        ctx.addIssue({
          code: 'custom',
          message: 'everyValue and everyUnit are required for every-mode schedules',
          path: ['everyValue']
        })
      }
    }
    if (value.mode === 'daily' || value.mode === 'weekly' || value.mode === 'monthly') {
      if (value.hour === undefined || value.minute === undefined) {
        ctx.addIssue({
          code: 'custom',
          message: 'hour and minute are required',
          path: ['hour']
        })
      }
    }
    if (value.mode === 'weekly' && (!value.daysOfWeek || value.daysOfWeek.length === 0)) {
      ctx.addIssue({
        code: 'custom',
        message: 'Select at least one weekday',
        path: ['daysOfWeek']
      })
    }
    if (value.mode === 'monthly' && value.dayOfMonth === undefined) {
      ctx.addIssue({
        code: 'custom',
        message: 'dayOfMonth is required for monthly schedules',
        path: ['dayOfMonth']
      })
    }
  })

export type TaskSchedule = z.infer<typeof TaskScheduleSchema>

export const FullPeriodSchema = z
  .object({
    value: z.number().int().min(1).max(10_000),
    unit: FullPeriodUnitSchema
  })
  .strict()

export type FullPeriod = z.infer<typeof FullPeriodSchema>

/**
 * Per-task backup settings (HOW backups are stored).
 * Archive password is never returned to the renderer — only hasArchivePassword.
 */
export const TaskBackupSettingsSchema = z
  .object({
    fullBackup: z.boolean(),
    fullPeriod: FullPeriodSchema.optional(),
    compress: z.boolean(),
    encryptArchive: z.boolean(),
    excludePatterns: z.array(z.string().min(1).max(200)).max(200).default([]),
    retention: z
      .object({
        keepCycles: z.number().int().min(1).max(10_000)
      })
      .strict()
      .optional()
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.fullBackup === false && value.fullPeriod) {
      ctx.addIssue({
        code: 'custom',
        message: 'fullPeriod only applies when fullBackup is true',
        path: ['fullPeriod']
      })
    }
    if (value.encryptArchive && !value.compress) {
      ctx.addIssue({
        code: 'custom',
        message: 'encryptArchive requires compress=true',
        path: ['encryptArchive']
      })
    }
  })

export type TaskBackupSettings = z.infer<typeof TaskBackupSettingsSchema>

export const TaskCreateSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1)
      .max(120)
      .regex(/^[a-zA-Z0-9][a-zA-Z0-9._ -]*$/, 'Invalid task name'),
    profileId: z.string().uuid(),
    targetFolder: z.string().trim().min(1).max(1024),
    schedule: TaskScheduleSchema,
    settings: TaskBackupSettingsSchema,
    enabled: z.boolean().default(true),
    catchUpMissed: z.boolean().default(false),
    /** Plain archive password — encrypted in main before storage. */
    archivePassword: z.string().min(1).max(500).optional()
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.settings.encryptArchive && !value.archivePassword) {
      ctx.addIssue({
        code: 'custom',
        message: 'archivePassword is required when encryptArchive is true',
        path: ['archivePassword']
      })
    }
  })

export type TaskCreateInput = z.infer<typeof TaskCreateSchema>

export const TaskUpdateSchema = z
  .object({
    id: z.string().uuid(),
    name: z
      .string()
      .trim()
      .min(1)
      .max(120)
      .regex(/^[a-zA-Z0-9][a-zA-Z0-9._ -]*$/)
      .optional(),
    profileId: z.string().uuid().optional(),
    targetFolder: z.string().trim().min(1).max(1024).optional(),
    schedule: TaskScheduleSchema.optional(),
    settings: TaskBackupSettingsSchema.optional(),
    enabled: z.boolean().optional(),
    catchUpMissed: z.boolean().optional(),
    archivePassword: z.string().min(1).max(500).optional(),
    clearArchivePassword: z.boolean().optional()
  })
  .strict()

export type TaskUpdateInput = z.infer<typeof TaskUpdateSchema>

export const TaskIdSchema = z.object({
  id: z.string().uuid()
})

/** Queue an immediate run. dryRun=true exercises planner + target checks only. */
export const TaskRunNowSchema = z
  .object({
    id: z.string().uuid(),
    dryRun: z.boolean().default(false)
  })
  .strict()

export type TaskRunNowInput = z.infer<typeof TaskRunNowSchema>

export const SchedulePreviewRequestSchema = z.object({
  schedule: TaskScheduleSchema,
  count: z.number().int().min(1).max(20).default(5)
})

export const TaskDtoSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  profileId: z.string().uuid(),
  profileName: z.string().nullable(),
  profileType: z.string().nullable(),
  targetFolder: z.string(),
  schedule: TaskScheduleSchema,
  settings: TaskBackupSettingsSchema,
  enabled: z.boolean(),
  catchUpMissed: z.boolean(),
  hasArchivePassword: z.boolean(),
  nextRunAt: z.string().nullable(),
  lastRunAt: z.string().nullable(),
  lastRunStatus: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string()
})

export type TaskDto = z.infer<typeof TaskDtoSchema>

export const SchedulePreviewSchema = z.object({
  cronExpression: z.string(),
  human: z.string(),
  timezone: z.string(),
  nextRuns: z.array(z.string())
})

export type SchedulePreview = z.infer<typeof SchedulePreviewSchema>

export const DashboardScheduleItemSchema = z.object({
  taskId: z.string().uuid(),
  taskName: z.string(),
  nextRunAt: z.string(),
  enabled: z.boolean(),
  lastStatus: z.string().nullable()
})

export type DashboardScheduleItem = z.infer<typeof DashboardScheduleItemSchema>
