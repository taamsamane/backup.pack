import mysql from 'mysql2/promise'
import { DEFAULT_PORTS } from '../../../shared/profiles'
import { withOptionalSshTunnel } from '../sshTunnel'
import type { ConnectionTester } from './types'

export const testMysqlConnection: ConnectionTester = async (profile) => {
  const started = Date.now()

  return withOptionalSshTunnel(profile, async (effective) => {
    if (!effective.host) {
      throw new Error('Host is required')
    }

    const connection = await mysql.createConnection({
      host: effective.host,
      port: effective.port ?? DEFAULT_PORTS.mysql,
      user: effective.username ?? undefined,
      password: effective.credentials.password,
      database: effective.options.database,
      connectTimeout: effective.options.readyTimeoutMs ?? 15_000
    })

    try {
      const [rows] = await connection.query('SELECT VERSION() AS version')
      const first = Array.isArray(rows) ? (rows[0] as { version?: string } | undefined) : undefined
      const version = first?.version ?? 'unknown'
      const viaTunnel = Boolean(profile.options.sshTunnelProfileId)
      return {
        ok: true,
        message: viaTunnel
          ? `MySQL/MariaDB connected via SSH tunnel (${String(version)})`
          : `MySQL/MariaDB connected (${String(version)})`,
        latencyMs: Date.now() - started,
        details: {
          version: String(version),
          viaSshTunnel: viaTunnel,
          effectiveHost: effective.host,
          effectivePort: effective.port ?? DEFAULT_PORTS.mysql
        }
      }
    } finally {
      await connection.end()
    }
  })
}
