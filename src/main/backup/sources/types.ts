import type { ManifestEntry } from '../../../shared/backup/types'
import type { ResolvedProfile } from '../../profiles/testers/types'

export type RemoteFileInfo = {
  /** Path relative to the backup remote root (manifest key). */
  relativePath: string
  /** Absolute/normalized path on the remote server (or S3 object key). */
  remotePath: string
  size: number
  mtime: Date | null
  /** S3 ETag when available (used for change detection). */
  etag?: string | null
}

export type SourceListResult = {
  files: RemoteFileInfo[]
  remoteRoot: string
}

export type SourceDownloadResult = {
  bytes: number
  fileCount: number
}

export type SourceAdapter = {
  readonly kind: string
  listFiles(profile: ResolvedProfile, remoteRoot: string): Promise<SourceListResult>
  downloadFiles(
    profile: ResolvedProfile,
    files: RemoteFileInfo[],
    localDir: string
  ): Promise<SourceDownloadResult>
}

export function remoteFileToManifestEntry(file: RemoteFileInfo): ManifestEntry {
  return {
    path: file.relativePath.replace(/\\/g, '/'),
    size: file.size,
    mtime: file.mtime ? file.mtime.toISOString() : null,
    hash: null,
    etag: file.etag ?? null,
    state: 'present'
  }
}
