import { Client as SshClient } from 'ssh2'
import SftpClient from 'ssh2-sftp-client'
import {
  asSshResolvedProfile,
  buildSshConnectConfig,
  resolveSshReadyTimeoutMs
} from '../sshConnection'
import type { ConnectionTester } from './types'

function formatSshFailure(error: unknown): Error {
  const message = error instanceof Error ? error.message : String(error)
  if (/handshake/i.test(message) || /timed out/i.test(message)) {
    return new Error(
      `${message}. Check host/port/firewall, and if a “Trust SSH host key?” dialog appeared, click Trust before the timeout.`
    )
  }
  return error instanceof Error ? error : new Error(message)
}

export const testSshConnection: ConnectionTester = async (profile) => {
  const started = Date.now()
  const client = new SshClient()
  const resolved = asSshResolvedProfile(profile, 'ssh')
  const options = buildSshConnectConfig(resolved)
  const host = resolved.host!
  const port = options.port ?? 22
  const waitMs = resolveSshReadyTimeoutMs(resolved, host, port) + 5_000

  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        client.end()
        reject(new Error('Timed out while waiting for handshake'))
      }, waitMs)

      client
        .on('ready', () => {
          clearTimeout(timer)
          client.end()
          resolve()
        })
        .on('error', (error) => {
          clearTimeout(timer)
          reject(error)
        })
        .connect(options)
    })
  } catch (error) {
    throw formatSshFailure(error)
  }

  return {
    ok: true,
    message: `SSH connected to ${profile.host}:${port}`,
    latencyMs: Date.now() - started
  }
}

export const testSftpConnection: ConnectionTester = async (profile) => {
  const started = Date.now()
  const sftp = new SftpClient()
  const resolved = asSshResolvedProfile(profile, 'sftp')
  const options = buildSshConnectConfig(resolved)

  try {
    await sftp.connect(options)
    await sftp.list('.')
    return {
      ok: true,
      message: `SFTP connected to ${profile.host}:${options.port}`,
      latencyMs: Date.now() - started
    }
  } catch (error) {
    throw formatSshFailure(error)
  } finally {
    await sftp.end().catch(() => undefined)
  }
}
