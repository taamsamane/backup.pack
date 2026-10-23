import { ZodError, type ZodType } from 'zod'
import { getLogger } from '../logging/logger'

export class IpcValidationError extends Error {
  readonly details: unknown

  constructor(channel: string, details: unknown) {
    super(`Invalid IPC payload for channel "${channel}"`)
    this.name = 'IpcValidationError'
    this.details = details
  }
}

/**
 * Parse and validate an IPC payload with Zod.
 * Throws IpcValidationError on failure (safe to return to renderer; no secrets).
 */
export function parseIpcPayload<T>(channel: string, schema: ZodType<T>, payload: unknown): T {
  try {
    return schema.parse(payload)
  } catch (error) {
    const log = getLogger('ipc')
    if (error instanceof ZodError) {
      log.warn({ channel, issues: error.issues }, 'IPC payload validation failed')
      throw new IpcValidationError(channel, error.issues)
    }
    log.warn({ channel, error: String(error) }, 'IPC payload validation failed')
    throw new IpcValidationError(channel, String(error))
  }
}

export function toIpcErrorMessage(error: unknown): string {
  if (error instanceof IpcValidationError) {
    return error.message
  }
  if (error instanceof Error) {
    return error.message
  }
  return 'Unknown error'
}
