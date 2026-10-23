import { createWriteStream } from 'fs'
import { mkdirSync } from 'fs'
import { dirname, join } from 'path'
import { pipeline } from 'stream/promises'
import { GetObjectCommand, ListObjectsV2Command, type _Object } from '@aws-sdk/client-s3'
import { createS3ClientFromProfile, normalizeS3Prefix } from '../../profiles/awsClient'
import type { ResolvedProfile } from '../../profiles/testers/types'
import { toOsPath } from '../../../shared/paths'
import type { RemoteFileInfo, SourceAdapter, SourceDownloadResult, SourceListResult } from './types'

function requireBucket(profile: ResolvedProfile): string {
  const bucket = profile.options.bucket?.trim()
  if (!bucket) {
    throw new Error('S3 profile requires options.bucket for backups')
  }
  return bucket
}

function objectToFile(obj: _Object, prefix: string): RemoteFileInfo | null {
  const key = obj.Key
  if (!key || key.endsWith('/')) {
    return null
  }
  let relativePath = key
  if (prefix) {
    const p = prefix.endsWith('/') ? prefix : `${prefix}/`
    if (!key.startsWith(p) && key !== prefix) {
      return null
    }
    relativePath = key === prefix ? key.split('/').pop() ?? key : key.slice(p.length)
  }
  if (!relativePath) {
    return null
  }
  return {
    relativePath,
    remotePath: key,
    size: obj.Size ?? 0,
    mtime: obj.LastModified ?? null,
    etag: obj.ETag ? obj.ETag.replace(/"/g, '') : null
  }
}

export const s3SourceAdapter: SourceAdapter = {
  kind: 's3',

  async listFiles(profile: ResolvedProfile, remoteRoot: string): Promise<SourceListResult> {
    const bucket = requireBucket(profile)
    const prefix = normalizeS3Prefix(remoteRoot || profile.options.remotePath)
    const client = createS3ClientFromProfile(profile)
    const files: RemoteFileInfo[] = []

    try {
      let continuationToken: string | undefined
      do {
        const page = await client.send(
          new ListObjectsV2Command({
            Bucket: bucket,
            Prefix: prefix || undefined,
            ContinuationToken: continuationToken
          })
        )
        for (const obj of page.Contents ?? []) {
          const file = objectToFile(obj, prefix)
          if (file) {
            files.push(file)
          }
        }
        continuationToken = page.IsTruncated ? page.NextContinuationToken : undefined
      } while (continuationToken)

      return { files, remoteRoot: prefix || '.' }
    } finally {
      client.destroy()
    }
  },

  async downloadFiles(
    profile: ResolvedProfile,
    files: RemoteFileInfo[],
    localDir: string
  ): Promise<SourceDownloadResult> {
    const bucket = requireBucket(profile)
    const client = createS3ClientFromProfile(profile)
    let bytes = 0
    let fileCount = 0

    try {
      for (const file of files) {
        const localPath = toOsPath(join(localDir, ...file.relativePath.split('/')))
        mkdirSync(dirname(localPath), { recursive: true })

        const result = await client.send(
          new GetObjectCommand({
            Bucket: bucket,
            Key: file.remotePath
          })
        )
        const body = result.Body
        if (!body) {
          throw new Error(`Empty S3 body for key ${file.remotePath}`)
        }

        // AWS SDK v3 Body is a Readable in Node
        const readable = body as NodeJS.ReadableStream
        await pipeline(readable, createWriteStream(localPath))
        bytes += file.size
        fileCount += 1
      }
    } finally {
      client.destroy()
    }

    return { bytes, fileCount }
  }
}
