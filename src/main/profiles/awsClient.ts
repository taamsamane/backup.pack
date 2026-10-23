import { S3Client } from '@aws-sdk/client-s3'
import { fromIni } from '@aws-sdk/credential-providers'
import type { ResolvedProfile } from './testers/types'

/** Build an S3 client from a resolved aws-s3 profile (keys or named profile). */
export function createS3ClientFromProfile(profile: ResolvedProfile): S3Client {
  const region = profile.options.region ?? 'us-east-1'

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

  return new S3Client({
    region,
    credentials,
    endpoint: profile.options.endpoint,
    forcePathStyle: profile.options.forcePathStyle ?? Boolean(profile.options.endpoint)
  })
}

/** Normalize an S3 key prefix (no leading slash; empty = whole bucket). */
export function normalizeS3Prefix(remotePath: string | undefined): string {
  const raw = (remotePath ?? '').trim().replace(/\\/g, '/')
  if (!raw || raw === '.' || raw === '/') {
    return ''
  }
  return raw.replace(/^\/+/, '').replace(/\/+$/, '')
}
