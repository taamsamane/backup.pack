import { accessSync, constants, statSync } from 'fs'
import Database from 'better-sqlite3'
import type { ConnectionTester } from './types'

export const testSqliteConnection: ConnectionTester = async (profile) => {
  const started = Date.now()
  const filePath = profile.options.filePath
  if (!filePath) {
    throw new Error('SQLite filePath is required')
  }

  accessSync(filePath, constants.R_OK)
  const stats = statSync(filePath)
  if (!stats.isFile()) {
    throw new Error('SQLite path is not a file')
  }

  const db = new Database(filePath, { readonly: true, fileMustExist: true })
  try {
    const row = db.prepare('SELECT sqlite_version() AS version').get() as { version: string }
    return {
      ok: true,
      message: `SQLite opened (${row.version})`,
      latencyMs: Date.now() - started,
      details: { version: row.version, sizeBytes: stats.size }
    }
  } finally {
    db.close()
  }
}
