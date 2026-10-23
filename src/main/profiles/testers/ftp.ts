import { Client } from 'basic-ftp'
import { DEFAULT_PORTS } from '../../../shared/profiles'
import type { ConnectionTester } from './types'

export const testFtpConnection: ConnectionTester = async (profile) => {
  const started = Date.now()
  if (!profile.host) {
    throw new Error('Host is required')
  }
  const client = new Client(profile.options.readyTimeoutMs ?? 15_000)
  client.ftp.verbose = false

  try {
    await client.access({
      host: profile.host,
      port: profile.port ?? DEFAULT_PORTS.ftp,
      user: profile.username ?? undefined,
      password: profile.credentials.password,
      secure: profile.options.secure ?? false
    })
    await client.pwd()
    return {
      ok: true,
      message: `FTP connected to ${profile.host}:${profile.port ?? DEFAULT_PORTS.ftp}`,
      latencyMs: Date.now() - started
    }
  } finally {
    client.close()
  }
}
