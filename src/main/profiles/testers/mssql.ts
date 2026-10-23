import sql from 'mssql'
import { DEFAULT_PORTS } from '../../../shared/profiles'
import { withOptionalSshTunnel } from '../sshTunnel'
import type { ConnectionTester } from './types'

export const testMssqlConnection: ConnectionTester = async (profile) => {
  const started = Date.now()

  return withOptionalSshTunnel(profile, async (effective) => {
    if (!effective.host) {
      throw new Error('Host is required')
    }

    const pool = await sql.connect({
      server: effective.host,
      port: effective.port ?? DEFAULT_PORTS.mssql,
      user: effective.username ?? undefined,
      password: effective.credentials.password,
      database: effective.options.database,
      connectionTimeout: effective.options.readyTimeoutMs ?? 15_000,
      options: {
        encrypt: effective.options.encrypt ?? true,
        trustServerCertificate: effective.options.trustServerCertificate ?? true
      }
    })

    try {
      const result = await pool.request().query<{ version: string }>('SELECT @@VERSION AS version')
      const version = result.recordset[0]?.version ?? 'unknown'
      const viaTunnel = Boolean(profile.options.sshTunnelProfileId)
      return {
        ok: true,
        message: viaTunnel
          ? 'Microsoft SQL Server connected via SSH tunnel'
          : 'Microsoft SQL Server connected',
        latencyMs: Date.now() - started,
        details: {
          version: version.split('\n')[0],
          viaSshTunnel: viaTunnel,
          effectiveHost: effective.host,
          effectivePort: effective.port ?? DEFAULT_PORTS.mssql
        }
      }
    } finally {
      await pool.close()
    }
  })
}
