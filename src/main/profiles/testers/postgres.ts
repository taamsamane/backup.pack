import pg from 'pg'
import { DEFAULT_PORTS } from '../../../shared/profiles'
import { withOptionalSshTunnel } from '../sshTunnel'
import type { ConnectionTester } from './types'

export const testPostgresConnection: ConnectionTester = async (profile) => {
  const started = Date.now()

  return withOptionalSshTunnel(profile, async (effective) => {
    if (!effective.host) {
      throw new Error('Host is required')
    }

    const client = new pg.Client({
      host: effective.host,
      port: effective.port ?? DEFAULT_PORTS.postgres,
      user: effective.username ?? undefined,
      password: effective.credentials.password,
      database: effective.options.database ?? 'postgres',
      connectionTimeoutMillis: effective.options.readyTimeoutMs ?? 15_000
    })

    try {
      await client.connect()
      const result = await client.query<{ version: string }>('SELECT version() AS version')
      const version = result.rows[0]?.version ?? 'unknown'
      const viaTunnel = Boolean(profile.options.sshTunnelProfileId)
      return {
        ok: true,
        message: viaTunnel
          ? 'PostgreSQL connected via SSH tunnel'
          : 'PostgreSQL connected',
        latencyMs: Date.now() - started,
        details: {
          version,
          viaSshTunnel: viaTunnel,
          effectiveHost: effective.host,
          effectivePort: effective.port ?? DEFAULT_PORTS.postgres
        }
      }
    } finally {
      await client.end().catch(() => undefined)
    }
  })
}
