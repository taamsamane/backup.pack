import { HeadBucketCommand, ListBucketsCommand } from '@aws-sdk/client-s3'
import { createS3ClientFromProfile } from '../awsClient'
import type { ConnectionTester } from './types'

export const testAwsS3Connection: ConnectionTester = async (profile) => {
  const started = Date.now()
  const region = profile.options.region ?? 'us-east-1'
  const client = createS3ClientFromProfile(profile)

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
