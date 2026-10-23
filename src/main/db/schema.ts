import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex
} from 'drizzle-orm/sqlite-core'

export const profileTypes = [
  'sftp',
  'ftp',
  'ssh',
  'mysql',
  'mariadb',
  'postgres',
  'mssql',
  'mongodb',
  'sqlite',
  'aws-s3'
] as const

export const authMethods = ['password', 'key', 'aws-keys', 'aws-profile', 'none'] as const

export const cycleStatuses = ['active', 'finalizing', 'archived'] as const

export const runStatuses = [
  'pending',
  'running',
  'success',
  'failed',
  'cancelled',
  'dry_run'
] as const

export const manifestStates = ['present', 'deleted'] as const

export const profiles = sqliteTable(
  'profiles',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    type: text('type', { enum: profileTypes }).notNull(),
    host: text('host'),
    port: integer('port'),
    username: text('username'),
    authMethod: text('auth_method', { enum: authMethods }).notNull(),
    credentialsEncrypted: text('credentials_encrypted'),
    optionsJson: text('options_json').notNull().default('{}'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull()
  },
  (table) => [uniqueIndex('idx_profiles_name').on(table.name)]
)

export const tasks = sqliteTable(
  'tasks',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    profileId: text('profile_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'restrict' }),
    targetFolder: text('target_folder').notNull(),
    scheduleJson: text('schedule_json').notNull(),
    settingsJson: text('settings_json').notNull(),
    enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
    catchUpMissed: integer('catch_up_missed', { mode: 'boolean' }).notNull().default(false),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull()
  },
  (table) => [
    uniqueIndex('idx_tasks_name').on(table.name),
    index('idx_tasks_profile_id').on(table.profileId)
  ]
)

export const cycles = sqliteTable(
  'cycles',
  {
    id: text('id').primaryKey(),
    taskId: text('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    folderName: text('folder_name').notNull(),
    startedAt: text('started_at').notNull(),
    endedAt: text('ended_at'),
    status: text('status', { enum: cycleStatuses }).notNull(),
    archivePath: text('archive_path'),
    createdAt: text('created_at').notNull()
  },
  (table) => [
    index('idx_cycles_task_id').on(table.taskId),
    index('idx_cycles_status').on(table.status)
  ]
)

export const taskRuns = sqliteTable(
  'task_runs',
  {
    id: text('id').primaryKey(),
    taskId: text('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    cycleId: text('cycle_id').references(() => cycles.id, { onDelete: 'set null' }),
    status: text('status', { enum: runStatuses }).notNull(),
    startedAt: text('started_at'),
    finishedAt: text('finished_at'),
    durationMs: integer('duration_ms'),
    bytesTotal: integer('bytes_total'),
    fileCount: integer('file_count'),
    errorMessage: text('error_message'),
    logPath: text('log_path'),
    dryRun: integer('dry_run', { mode: 'boolean' }).notNull().default(false),
    createdAt: text('created_at').notNull()
  },
  (table) => [
    index('idx_task_runs_task_id').on(table.taskId),
    index('idx_task_runs_created_at').on(table.createdAt)
  ]
)

export const fileManifest = sqliteTable(
  'file_manifest',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    taskId: text('task_id').notNull(),
    cycleId: text('cycle_id'),
    path: text('path').notNull(),
    size: integer('size'),
    mtime: text('mtime'),
    hash: text('hash'),
    etag: text('etag'),
    state: text('state', { enum: manifestStates }).notNull(),
    updatedAt: text('updated_at').notNull()
  },
  (table) => [
    uniqueIndex('idx_file_manifest_task_cycle_path').on(table.taskId, table.cycleId, table.path),
    index('idx_file_manifest_task_cycle').on(table.taskId, table.cycleId),
    index('idx_file_manifest_hash').on(table.hash)
  ]
)

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  valueJson: text('value_json').notNull()
})

export const sshHostKeys = sqliteTable(
  'ssh_host_keys',
  {
    id: text('id').primaryKey(),
    host: text('host').notNull(),
    port: integer('port').notNull(),
    fingerprint: text('fingerprint').notNull(),
    publicKey: text('public_key').notNull(),
    algorithm: text('algorithm'),
    trustedAt: text('trusted_at').notNull()
  },
  (table) => [uniqueIndex('idx_ssh_host_keys_host_port').on(table.host, table.port)]
)

/** Schema object passed to drizzle() for typed queries. */
export const schema = {
  profiles,
  tasks,
  cycles,
  taskRuns,
  fileManifest,
  settings,
  sshHostKeys
}

export type Profile = typeof profiles.$inferSelect
export type NewProfile = typeof profiles.$inferInsert
export type Task = typeof tasks.$inferSelect
export type NewTask = typeof tasks.$inferInsert
export type Cycle = typeof cycles.$inferSelect
export type TaskRun = typeof taskRuns.$inferSelect
export type FileManifestRow = typeof fileManifest.$inferSelect
export type SettingRow = typeof settings.$inferSelect
export type SshHostKey = typeof sshHostKeys.$inferSelect
