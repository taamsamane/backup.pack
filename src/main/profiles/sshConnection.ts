import type { ConnectConfig } from 'ssh2'
import { DEFAULT_PORTS, type ProfileType } from '../../shared/profiles'
import { getTrustedHostKey, verifySshHostKey } from '../security/sshHostKeys'
import type { ResolvedProfile } from './testers/types'

/** Enough time for the Trust host-key dialog (ssh2 readyTimeout includes hostVerifier wait). */
export const SSH_INTERACTIVE_READY_TIMEOUT_MS = 120_000

/** Read SSH public-key type string from OpenSSH wire-format buffer. */
function algorithmFromHostKey(key: Buffer): string {
  if (key.length < 4) {
    return 'unknown'
  }
  const length = key.readUInt32BE(0)
  if (length <= 0 || length > 64 || key.length < 4 + length) {
    return 'unknown'
  }
  return key.subarray(4, 4 + length).toString('ascii')
}

export function resolveSshReadyTimeoutMs(profile: ResolvedProfile, host: string, port: number): number {
  const configured = profile.options.readyTimeoutMs
  if (configured && configured > 0) {
    return Math.max(configured, SSH_INTERACTIVE_READY_TIMEOUT_MS)
  }
  // Unknown hosts need UI TOFU time; known hosts can stay shorter but still generous.
  const trusted = getTrustedHostKey(host, port)
  return trusted ? 30_000 : SSH_INTERACTIVE_READY_TIMEOUT_MS
}

export function buildSshConnectConfig(profile: ResolvedProfile): ConnectConfig {
  const host = profile.host
  if (!host) {
    throw new Error('SSH host is required')
  }

  const port =
    profile.port ??
    (profile.type === 'sftp' || profile.type === 'ssh'
      ? DEFAULT_PORTS[profile.type]
      : DEFAULT_PORTS.ssh)

  const readyTimeout = resolveSshReadyTimeoutMs(profile, host, port)

  const config: ConnectConfig = {
    host,
    port,
    username: profile.username ?? undefined,
    readyTimeout,
    hostVerifier: (key, done): void => {
      const algorithm = algorithmFromHostKey(key)
      void verifySshHostKey({ host, port, publicKey: key, algorithm })
        .then((ok) => {
          done(ok)
        })
        .catch(() => {
          done(false)
        })
    }
  }

  if (profile.authMethod === 'password') {
    if (!profile.credentials.password) {
      throw new Error('SSH password is required')
    }
    config.password = profile.credentials.password
  } else if (profile.authMethod === 'key') {
    if (!profile.credentials.privateKey) {
      throw new Error('SSH private key is required')
    }
    config.privateKey = profile.credentials.privateKey
    if (profile.credentials.passphrase) {
      config.passphrase = profile.credentials.passphrase
    }
  } else {
    throw new Error(`Unsupported SSH auth method: ${profile.authMethod}`)
  }

  return config
}

export function asSshResolvedProfile(
  profile: ResolvedProfile,
  type: Extract<ProfileType, 'ssh' | 'sftp'> = 'ssh'
): ResolvedProfile {
  return { ...profile, type }
}
