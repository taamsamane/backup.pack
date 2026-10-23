import { HeadBucketCommand, ListBucketsCommand, S3Client } from '@aws-sdk/client-s3'
import { fromIni } from '@aws-sdk/credential-providers'
import type { ConnectionTester } from './types'

export const testAwsS3Connection: ConnectionTester = async (profile) => {
  const started = Date.now()
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

  const client = new S3Client({
    region,
    credentials,
    endpoint: profile.options.endpoint,
    forcePathStyle: profile.options.forcePathStyle ?? Boolean(profile.options.endpoint)
  })

  try {
    const bucket = profile.options.bucket
    if (bucket) {
      await client.send(new HeadBucketCommand({ Bucket: bucket }))
      return {
        ok: true,
        message: `S3 bucket reachable: ${bucket}`,
        latencyMs: Date.now() - started,
        details: { region, bucket }
      }
    }

    const listed = await client.send(new ListBucketsCommand({}))
    const count = listed.Buckets?.length ?? 0
    return {
      ok: true,
      message: `S3 connected (${count} bucket${count === 1 ? '' : 's'} visible)`,
      latencyMs: Date.now() - started,
      details: { region, bucketCount: count }
    }
  } finally {
    client.destroy()
  }
}
