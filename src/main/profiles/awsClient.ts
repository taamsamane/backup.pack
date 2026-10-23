import { S3Client } from '@aws-sdk/client-s3'
import { fromIni } from '@aws-sdk/credential-providers'
import type { ResolvedProfile } from './testers/types'

/**
 * If the user pasted a virtual-host URL like
 * `https://my-bucket.s3.region.arvanstorage.ir`, strip the bucket subdomain
 * so the SDK can use path-style `https://s3.region…/my-bucket/…`.
 */
export function normalizeS3Endpoint(
  endpoint: string | undefined,
  bucket?: string | null
): string | undefined {
  const raw = endpoint?.trim()
  if (!raw) {
    return undefined
  }
  try {
    const url = new URL(raw)
    if (bucket) {
      const prefix = `${bucket}.`
      if (url.hostname.startsWith(prefix)) {
        url.hostname = url.hostname.slice(prefix.length)
      }
    }
    // Drop trailing slash — SDK appends paths itself
    return url.toString().replace(/\/+$/, '')
  } catch {
    return raw.replace(/\/+$/, '')
  }
}

/** Build an S3 client from a resolved aws-s3 profile (keys or named profile). */
export function createS3ClientFromProfile(profile: ResolvedProfile): S3Client {
  const region = profile.options.region?.trim() || 'us-east-1'
  const bucket = profile.options.bucket?.trim() || null
  const endpoint = normalizeS3Endpoint(profile.options.endpoint, bucket)
  const hasCustomEndpoint = Boolean(endpoint)

  let credentials:
    | { accessKeyId: string; secretAccessKey: string; sessionToken?: string }
    | ReturnType<typeof fromIni>
    | undefined

  if (profile.authMethod === 'aws-keys') {
    if (!profile.credentials.accessKeyId || !profile.credentials.secretAccessKey) {
      throw new Error('AWS access key and secret are required')
    }
    credentials = {
      accessKeyId: profile.credentials.accessKeyId,
      secretAccessKey: profile.credentials.secretAccessKey,
      sessionToken: profile.credentials.sessionToken
    }
  } else if (profile.authMethod === 'aws-profile') {
    credentials = fromIni({ profile: profile.options.awsProfile ?? 'default' })
  } else {
    throw new Error(`Unsupported AWS auth method: ${profile.authMethod}`)
  }

  // Custom endpoints (Arvan, MinIO, …) almost always need path-style.
  const forcePathStyle =
    profile.options.forcePathStyle ?? (hasCustomEndpoint ? true : false)

  return new S3Client({
    region,
    credentials,
    endpoint,
    forcePathStyle,
    // AWS SDK default flexible checksums break many S3-compatible APIs (UnknownError).
    ...(hasCustomEndpoint
      ? {
          requestChecksumCalculation: 'WHEN_REQUIRED' as const,
          responseChecksumValidation: 'WHEN_REQUIRED' as const
        }
      : {})
  })
}

/** Human-readable S3 / AWS SDK error (avoid bare "UnknownError"). */
export function formatS3Error(error: unknown): string {
  if (!(error instanceof Error) && (typeof error !== 'object' || error === null)) {
    return String(error)
  }

  const e = error as Error & {
    name?: string
    Code?: string
    code?: string
    $metadata?: { httpStatusCode?: number; requestId?: string }
    cause?: unknown
  }

  const name = e.name || e.Code || e.code || 'Error'
  const message = (e.message || '').trim()
  const status = e.$metadata?.httpStatusCode
  const parts: string[] = []

  if (message && message !== 'Unknown' && message !== 'UnknownError') {
    parts.push(message)
  } else if (name && name !== 'UnknownError') {
    parts.push(name)
  } else {
    parts.push('S3 request failed')
  }

  if (status) {
    parts.push(`(HTTP ${status})`)
  }
  if (e.Code && e.Code !== name && e.Code !== message) {
    parts.push(`[${e.Code}]`)
  }

  if (name === 'UnknownError' || message === 'UnknownError') {
    parts.push(
      'Hint: for Arvan/MinIO use endpoint https://s3.<region>.arvanstorage.ir (not bucket.s3…), enable path-style, and set the bucket name separately.'
    )
  }

  if (e.cause instanceof Error && e.cause.message) {
    parts.push(`Cause: ${e.cause.message}`)
  }

  return parts.join(' ')
}

/** Normalize an S3 key prefix (no leading slash; empty = whole bucket). */
export function normalizeS3Prefix(remotePath: string | undefined): string {
  const raw = (remotePath ?? '').trim().replace(/\\/g, '/')
  if (!raw || raw === '.' || raw === '/') {
    return ''
  }
  return raw.replace(/^\/+/, '').replace(/\/+$/, '')
}
