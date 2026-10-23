import { mkdirSync } from 'fs'
import { dirname, join } from 'path'
import { app } from 'electron'
import { count, eq } from 'drizzle-orm'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { DEFAULT_SETTINGS, type AppSettings } from '../../shared/settings'
import { getLogger } from '../logging/logger'
import {
  bindOrm,
  closeOrm,
  createSqliteConnection,
  getOrm,
  getSqlite,
  type AppDatabase
} from './client'
import {
  cycles,
  fileManifest,
  profiles,
  settings,
  sshHostKeys,
  taskRuns,
  tasks
} from './schema'

let databasePath: string | null = null

export function getDatabasePath(): string {
  if (!databasePath) {
    databasePath = join(app.getPath('userData'), 'data', 'backuphub.sqlite')
  }
  return databasePath
}

/**
 * Drizzle SQL migrations folder.
 * Dev: project root `/drizzle`. Packaged: `resources/drizzle` (extraResources).
 */
export function getMigrationsFolder(): string {
  if (app.isPackaged) {
    return join(process.resourcesPath, 'drizzle')
  }
  return join(app.getAppPath(), 'drizzle')
}

function seedDefaultSettings(db: AppDatabase): void {
  db.transaction((tx) => {
    for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
      tx.insert(settings)
        .values({ key, valueJson: JSON.stringify(value) })
        .onConflictDoNothing()
        .run()
    }
  })
}

export function initDatabase(): AppDatabase {
  const log = getLogger('db')
  const path = getDatabasePath()
  const migrationsFolder = getMigrationsFolder()
  mkdirSync(dirname(path), { recursive: true })

  const sqlite = createSqliteConnection(path)
  const db = bindOrm(sqlite)

  migrate(db, { migrationsFolder })
  seedDefaultSettings(db)

  log.info({ path, migrationsFolder }, 'Database ready (Drizzle ORM)')
  return db
}

export function closeDatabase(): void {
  closeOrm()
  getLogger('db').info('Database closed')
}

export function getAllSettingsFromDb(): AppSettings {
  const db = getOrm()
  const rows = db.select().from(settings).all()
  const result: Record<string, unknown> = { ...DEFAULT_SETTINGS }
  for (const row of rows) {
    result[row.key] = JSON.parse(row.valueJson)
  }
  return result as AppSettings
}

export function getSettingFromDb<K extends keyof AppSettings>(key: K): AppSettings[K] {
  const db = getOrm()
  const row = db.select().from(settings).where(eq(settings.key, key)).get()
  if (!row) {
    return DEFAULT_SETTINGS[key]
  }
  return JSON.parse(row.valueJson) as AppSettings[K]
}

export function setSettingsInDb(values: Partial<AppSettings>): AppSettings {
  const db = getOrm()
  db.transaction((tx) => {
    for (const [key, value] of Object.entries(values)) {
      if (value === undefined) {
        continue
      }
      tx.insert(settings)
        .values({ key, valueJson: JSON.stringify(value) })
        .onConflictDoUpdate({
          target: settings.key,
          set: { valueJson: JSON.stringify(value) }
        })
        .run()
    }
  })
  return getAllSettingsFromDb()
}

function countTable(
  db: AppDatabase,
  table:
    | typeof profiles
    | typeof tasks
    | typeof taskRuns
    | typeof cycles
    | typeof fileManifest
    | typeof settings
    | typeof sshHostKeys
): number {
  const row = db.select({ value: count() }).from(table).get()
  return row?.value ?? 0
}

export function getDbHealthSnapshot(): {
  ok: boolean
  path: string
  migrationCount: number
  schemaVersion: string | null
  tableCounts: Record<string, number>
} {
  const db = getOrm()
  const sqlite = getSqlite()
  const path = getDatabasePath()

  const migrationRows = sqlite
    .prepare(
      `SELECT hash, created_at FROM __drizzle_migrations ORDER BY created_at ASC`
    )
    .all() as Array<{ hash: string; created_at: number }>

  const latest = migrationRows.at(-1)

  return {
    ok: true,
    path,
    migrationCount: migrationRows.length,
    schemaVersion: latest ? latest.hash.slice(0, 12) : null,
    tableCounts: {
      profiles: countTable(db, profiles),
      tasks: countTable(db, tasks),
      task_runs: countTable(db, taskRuns),
      cycles: countTable(db, cycles),
      file_manifest: countTable(db, fileManifest),
      settings: countTable(db, settings),
      ssh_host_keys: countTable(db, sshHostKeys)
    }
  }
}

/** Expose ORM for later modules (profiles, tasks, …). */
export function getDb(): AppDatabase {
  return getOrm()
}
