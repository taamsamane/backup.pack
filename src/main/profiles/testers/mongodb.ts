import { MongoClient } from 'mongodb'
import { DEFAULT_PORTS } from '../../../shared/profiles'
import { withOptionalSshTunnel } from '../sshTunnel'
import type { ConnectionTester } from './types'

export const testMongodbConnection: ConnectionTester = async (profile) => {
  const started = Date.now()

  return withOptionalSshTunnel(profile, async (effective) => {
    if (!effective.host) {
      throw new Error('Host is required')
    }

    const port = effective.port ?? DEFAULT_PORTS.mongodb
    const user = effective.username ? encodeURIComponent(effective.username) : ''
    const pass = effective.credentials.password
      ? encodeURIComponent(effective.credentials.password)
      : ''
    const auth = user && pass ? `${user}:${pass}@` : user ? `${user}@` : ''
    const dbName = effective.options.database
      ? `/${encodeURIComponent(effective.options.database)}`
      : '/'
    const authSource = effective.options.authSource
      ? `?authSource=${encodeURIComponent(effective.options.authSource)}`
      : ''

    const uri = `mongodb://${auth}${effective.host}:${port}${dbName}${authSource}`

    const client = new MongoClient(uri, {
      serverSelectionTimeoutMS: effective.options.readyTimeoutMs ?? 15_000,
      connectTimeoutMS: effective.options.readyTimeoutMs ?? 15_000
    })

    try {
      await client.connect()
      const admin = client.db().admin()
      const info = await admin.ping()
      const viaTunnel = Boolean(profile.options.sshTunnelProfileId)
      return {
        ok: true,
        message: viaTunnel ? 'MongoDB connected via SSH tunnel' : 'MongoDB connected',
        latencyMs: Date.now() - started,
        details: {
          ok: info.ok,
          viaSshTunnel: viaTunnel,
          effectiveHost: effective.host,
          effectivePort: port
        }
      }
    } finally {
      await client.close().catch(() => undefined)
    }
  })
}
