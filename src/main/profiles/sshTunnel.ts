import { createServer, type AddressInfo, type Server, type Socket } from 'net'
import { Client as SshClient } from 'ssh2'
import { loadProfileForConnection } from './repository'
import {
  asSshResolvedProfile,
  buildSshConnectConfig,
  resolveSshReadyTimeoutMs
} from './sshConnection'
import type { ResolvedProfile } from './testers/types'

export type SshTunnelHandle = {
  localHost: string
  localPort: number
  close: () => Promise<void>
}

/**
 * Open a local TCP port that forwards through SSH to destHost:destPort
 * (as reachable from the SSH server — often 127.0.0.1:3306).
 */
export async function openSshTunnel(params: {
  sshProfileId: string
  destHost: string
  destPort: number
  readyTimeoutMs?: number
}): Promise<SshTunnelHandle> {
  const loaded = loadProfileForConnection(params.sshProfileId)
  if (loaded.row.type !== 'ssh' && loaded.row.type !== 'sftp') {
    throw new Error('SSH tunnel profile must be type ssh or sftp')
  }

  const sshProfile: ResolvedProfile = asSshResolvedProfile(
    {
      type: loaded.row.type,
      name: loaded.row.name,
      host: loaded.row.host,
      port: loaded.row.port,
      username: loaded.row.username,
      authMethod: loaded.row.authMethod,
      credentials: loaded.credentials,
      options: loaded.options
    },
    loaded.row.type === 'sftp' ? 'sftp' : 'ssh'
  )

  const config = buildSshConnectConfig(sshProfile)
  const client = new SshClient()
  const sockets = new Set<Socket>()
  const host = sshProfile.host!
  const port = config.port ?? 22
  const waitMs =
    (params.readyTimeoutMs && params.readyTimeoutMs > 0
      ? Math.max(params.readyTimeoutMs, resolveSshReadyTimeoutMs(sshProfile, host, port))
      : resolveSshReadyTimeoutMs(sshProfile, host, port)) + 5_000

  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        client.end()
        reject(new Error('Timed out while waiting for handshake'))
      }, waitMs)

      client
        .on('ready', () => {
          clearTimeout(timer)
          resolve()
        })
        .on('error', (error) => {
          clearTimeout(timer)
          reject(error)
        })
        .connect(config)
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (/handshake/i.test(message) || /timed out/i.test(message)) {
      throw new Error(
        `SSH tunnel: ${message}. Check the jump-host profile, and accept the “Trust SSH host key?” dialog if it appears.`
      )
    }
    throw error instanceof Error ? error : new Error(message)
  }

  const server: Server = createServer((socket) => {
    sockets.add(socket)
    socket.on('close', () => sockets.delete(socket))
    socket.on('error', () => {
      socket.destroy()
      sockets.delete(socket)
    })

    client.forwardOut(
      '127.0.0.1',
      0,
      params.destHost,
      params.destPort,
      (error, stream) => {
        if (error) {
          socket.destroy()
          return
        }
        socket.pipe(stream)
        stream.pipe(socket)
        stream.on('close', () => socket.destroy())
        stream.on('error', () => socket.destroy())
      }
    )
  })

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => resolve())
  })

  const address = server.address() as AddressInfo

  return {
    localHost: '127.0.0.1',
    localPort: address.port,
    close: async () => {
      for (const socket of sockets) {
        socket.destroy()
      }
      sockets.clear()
      await new Promise<void>((resolve) => {
        server.close(() => resolve())
      })
      client.end()
    }
  }
}

/**
 * If the DB profile references an SSH tunnel profile, open the tunnel and
 * rewrite host/port to the local forward. Always closes the tunnel afterward.
 */
export async function withOptionalSshTunnel<T>(
  profile: ResolvedProfile,
  run: (effective: ResolvedProfile) => Promise<T>
): Promise<T> {
  const tunnelProfileId = profile.options.sshTunnelProfileId
  if (!tunnelProfileId) {
    return run(profile)
  }

  if (!profile.host) {
    throw new Error('Database host is required (as reachable from the SSH server)')
  }

  const destPort =
    profile.port ??
    (profile.type === 'mysql' || profile.type === 'mariadb'
      ? 3306
      : profile.type === 'postgres'
        ? 5432
        : profile.type === 'mssql'
          ? 1433
          : profile.type === 'mongodb'
            ? 27017
            : undefined)

  if (!destPort) {
    throw new Error('Database port is required for SSH tunnel')
  }

  const tunnel = await openSshTunnel({
    sshProfileId: tunnelProfileId,
    destHost: profile.host,
    destPort,
    readyTimeoutMs: profile.options.readyTimeoutMs
  })

  try {
    return await run({
      ...profile,
      host: tunnel.localHost,
      port: tunnel.localPort
    })
  } finally {
    await tunnel.close()
  }
}
