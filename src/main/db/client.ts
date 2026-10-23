import Database from 'better-sqlite3'
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import { schema } from './schema'

export type AppDatabase = BetterSQLite3Database<typeof schema>

let sqlite: Database.Database | null = null
let orm: AppDatabase | null = null

export function createSqliteConnection(databasePath: string): Database.Database {
  const connection = new Database(databasePath)
  connection.pragma('journal_mode = WAL')
  connection.pragma('foreign_keys = ON')
  connection.pragma('busy_timeout = 5000')
  return connection
}

export function bindOrm(connection: Database.Database): AppDatabase {
  sqlite = connection
  orm = drizzle(connection, { schema })
  return orm
}

export function getSqlite(): Database.Database {
  if (!sqlite) {
    throw new Error('SQLite connection has not been initialized.')
  }
  return sqlite
}

export function getOrm(): AppDatabase {
  if (!orm) {
    throw new Error('Drizzle ORM has not been initialized. Call initDatabase() first.')
  }
  return orm
}

export function closeOrm(): void {
  if (sqlite) {
    sqlite.close()
  }
  sqlite = null
  orm = null
}
