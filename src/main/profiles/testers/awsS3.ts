import { HeadBucketCommand, ListBucketsCommand, ListObjectsV2Command } from '@aws-sdk/client-s3'
import { createS3ClientFromProfile, formatS3Error, normalizeS3Endpoint } from '../awsClient'
import type { ConnectionTester } from './types'

export const testAwsS3Connection: ConnectionTester = async (profile) => {
  const started = Date.now()
  const region = profile.options.region?.trim() || 'us-east-1'
  const bucket = profile.options.bucket?.trim()
  const endpoint = normalizeS3Endpoint(profile.options.endpoint, bucket)
  const client = createS3ClientFromProfile(profile)

  try {
    if (bucket) {
      try {
        await client.send(new HeadBucketCommand({ Bucket: bucket }))
      } catch (headError) {
        // Many S3-compatible providers (Arvan, some MinIO setups) reject HeadBucket.
        // Fall back to a cheap list — proves credentials + bucket access.
        try {
          await client.send(
            new ListObjectsV2Command({
              Bucket: bucket,
              MaxKeys: 1
            })
          )
        } catch (listError) {
          throw new Error(
            `${formatS3Error(listError)} (HeadBucket also failed: ${formatS3Error(headError)})`
          )
        }
      }

      return {
        ok: true,
        message: endpoint
          ? `S3-compatible bucket reachable: ${bucket} via ${endpoint}`
          : `S3 bucket reachable: ${bucket}`,
        latencyMs: Date.now() - started,
        details: { region, bucket, endpoint: endpoint ?? null }
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
  } catch (error) {
    throw new Error(formatS3Error(error))
  } finally {
    client.destroy()
  }
}
