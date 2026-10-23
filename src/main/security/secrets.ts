import { safeStorage } from 'electron'
import type { ProfileCredentials } from '../../shared/profiles'
import { ProfileCredentialsSchema } from '../../shared/profiles'
import { getLogger } from '../logging/logger'

/**
 * Encrypt credential JSON with Electron safeStorage (OS keychain / DPAPI / libsecret).
 * Never log plaintext or ciphertext.
 */
export function encryptCredentials(credentials: ProfileCredentials): string {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error(
      'Credential encryption is unavailable on this system (safeStorage). Cannot store secrets.'
    )
  }
  const parsed = ProfileCredentialsSchema.parse(credentials)
  const payload = Buffer.from(JSON.stringify(parsed), 'utf8')
  const encrypted = safeStorage.encryptString(payload.toString('utf8'))
  return encrypted.toString('base64')
}

export function decryptCredentials(encoded: string | null | undefined): ProfileCredentials {
  if (!encoded) {
    return {}
  }
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('Credential decryption is unavailable on this system (safeStorage).')
  }
  try {
    const buffer = Buffer.from(encoded, 'base64')
    const json = safeStorage.decryptString(buffer)
    return ProfileCredentialsSchema.parse(JSON.parse(json))
  } catch (error) {
    getLogger('secrets').error({ err: String(error) }, 'Failed to decrypt credentials')
    throw new Error('Stored credentials could not be decrypted on this machine.')
  }
}

export function mergeCredentials(
  existing: ProfileCredentials,
  patch: ProfileCredentials | undefined,
  clear: boolean | undefined
): ProfileCredentials | null {
  if (clear) {
    return null
  }
  if (!patch) {
    return Object.keys(existing).length > 0 ? existing : null
  }
  const merged: ProfileCredentials = { ...existing }
  for (const [key, value] of Object.entries(patch) as Array<
    [keyof ProfileCredentials, string | undefined]
  >) {
    if (value === undefined) {
      continue
    }
    if (value === '') {
      delete merged[key]
    } else {
      merged[key] = value
    }
  }
  return Object.keys(merged).length > 0 ? merged : null
}

export function credentialPresence(credentials: ProfileCredentials): {
  hasPassword: boolean
  hasPrivateKey: boolean
  hasPassphrase: boolean
  hasAccessKeyId: boolean
  hasSecretAccessKey: boolean
  hasSessionToken: boolean
} {
  return {
    hasPassword: Boolean(credentials.password),
    hasPrivateKey: Boolean(credentials.privateKey),
    hasPassphrase: Boolean(credentials.passphrase),
    hasAccessKeyId: Boolean(credentials.accessKeyId),
    hasSecretAccessKey: Boolean(credentials.secretAccessKey),
    hasSessionToken: Boolean(credentials.sessionToken)
  }
}
