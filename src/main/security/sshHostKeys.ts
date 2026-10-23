import { createHash, randomUUID } from 'crypto'
import { eq, and } from 'drizzle-orm'
import type { SshHostKeyDecision, SshHostKeyPrompt } from '../../shared/profiles'
import { getOrm } from '../db/client'
import { sshHostKeys } from '../db/schema'
import { getMainWindow } from '../app/window'
import { getLogger } from '../logging/logger'
import { IpcChannels } from '../../shared/ipc/channels'

type PendingDecision = {
  resolve: (trust: boolean) => void
  reject: (error: Error) => void
  timer: NodeJS.Timeout
}

const pending = new Map<string, PendingDecision>()

export function fingerprintFromPublicKey(publicKey: Buffer, algorithm: string): string {
  const hash = createHash('sha256').update(publicKey).digest('base64')
  return `${algorithm.toUpperCase()} SHA256:${hash}`
}

export function getTrustedHostKey(
  host: string,
  port: number
): { fingerprint: string; publicKey: string; algorithm: string | null } | null {
  const row = getOrm()
    .select()
    .from(sshHostKeys)
    .where(and(eq(sshHostKeys.host, host), eq(sshHostKeys.port, port)))
    .get()
  if (!row) {
    return null
  }
  return {
    fingerprint: row.fingerprint,
    publicKey: row.publicKey,
    algorithm: row.algorithm
  }
}

export function trustHostKey(input: {
  host: string
  port: number
  fingerprint: string
  publicKey: string
  algorithm: string
}): void {
  const db = getOrm()
  const existing = getTrustedHostKey(input.host, input.port)
  const now = new Date().toISOString()
  if (existing) {
    db.update(sshHostKeys)
      .set({
        fingerprint: input.fingerprint,
        publicKey: input.publicKey,
        algorithm: input.algorithm,
        trustedAt: now
      })
      .where(and(eq(sshHostKeys.host, input.host), eq(sshHostKeys.port, input.port)))
      .run()
    return
  }
  db.insert(sshHostKeys)
    .values({
      id: randomUUID(),
      host: input.host,
      port: input.port,
      fingerprint: input.fingerprint,
      publicKey: input.publicKey,
      algorithm: input.algorithm,
      trustedAt: now
    })
    .run()
}

/**
 * Ask the renderer to trust an SSH host key (TOFU or changed key).
 * Resolves true if the user trusts, false if rejected / timed out.
 */
export function promptTrustHostKey(prompt: Omit<SshHostKeyPrompt, 'requestId'>): Promise<boolean> {
  const requestId = randomUUID()
  const payload: SshHostKeyPrompt = { ...prompt, requestId }
  const win = getMainWindow()
  if (!win) {
    getLogger('sshHostKeys').warn('No main window for SSH host-key prompt')
    return Promise.resolve(false)
  }

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(requestId)
      getLogger('sshHostKeys').warn(
        { host: prompt.host, port: prompt.port },
        'SSH host-key prompt timed out without a decision'
      )
      resolve(false)
    }, 120_000)

    pending.set(requestId, {
      resolve: (trust) => {
        clearTimeout(timer)
        pending.delete(requestId)
        resolve(trust)
      },
      reject: (error) => {
        clearTimeout(timer)
        pending.delete(requestId)
        reject(error)
      },
      timer
    })

    if (win.isMinimized()) {
      win.restore()
    }
    win.show()
    win.focus()
    win.webContents.send(IpcChannels.SSH_HOST_KEY_PROMPT, payload)
    getLogger('sshHostKeys').info(
      {
        host: prompt.host,
        port: prompt.port,
        fingerprint: prompt.fingerprint,
        isNew: prompt.isNew
      },
      'SSH host key prompt sent to UI'
    )
  })
}

export function resolveHostKeyDecision(decision: SshHostKeyDecision): void {
  const entry = pending.get(decision.requestId)
  if (!entry) {
    return
  }
  entry.resolve(decision.trust)
}

/**
 * ssh2 hostVerifier callback factory.
 * Returns whether the connection should continue.
 */
export async function verifySshHostKey(params: {
  host: string
  port: number
  publicKey: Buffer
  algorithm: string
}): Promise<boolean> {
  const fingerprint = fingerprintFromPublicKey(params.publicKey, params.algorithm)
  const publicKeyBase64 = params.publicKey.toString('base64')
  const trusted = getTrustedHostKey(params.host, params.port)

  if (trusted && trusted.fingerprint === fingerprint) {
    return true
  }

  const isNew = !trusted
  const trust = await promptTrustHostKey({
    host: params.host,
    port: params.port,
    fingerprint,
    algorithm: params.algorithm,
    isNew,
    previousFingerprint: trusted?.fingerprint ?? null
  })

  if (!trust) {
    return false
  }

  trustHostKey({
    host: params.host,
    port: params.port,
    fingerprint,
    publicKey: publicKeyBase64,
    algorithm: params.algorithm
  })
  return true
}
