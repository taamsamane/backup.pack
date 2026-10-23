import { mkdirSync } from 'fs'
import { dirname, join } from 'path'
import { Client, type FileInfo } from 'basic-ftp'
import { DEFAULT_PORTS } from '../../../shared/profiles'
import {
  joinRemotePath,
  normalizeRemotePath,
  toRelativeRemotePath
} from '../../../shared/backup/remotePath'
import { toOsPath } from '../../../shared/paths'
import type { ResolvedProfile } from '../../profiles/testers/types'
import type { RemoteFileInfo, SourceAdapter, SourceDownloadResult, SourceListResult } from './types'

async function withFtp<T>(
  profile: ResolvedProfile,
  fn: (client: Client) => Promise<T>
): Promise<T> {
  if (!profile.host) {
    throw new Error('FTP host is required')
  }
  const client = new Client(profile.options.readyTimeoutMs ?? 60_000)
  client.ftp.verbose = false
  try {
    await client.access({
      host: profile.host,
      port: profile.port ?? DEFAULT_PORTS.ftp,
      user: profile.username ?? undefined,
      password: profile.credentials.password,
      secure: profile.options.secure ?? false
    })
    return await fn(client)
  } finally {
    client.close()
  }
}

async function walk(
  client: Client,
  remoteDir: string,
  remoteRoot: string,
  out: RemoteFileInfo[]
): Promise<void> {
  let listing: FileInfo[]
  try {
    listing = await client.list(remoteDir)
  } catch (error) {
    throw new Error(
      `FTP list failed for ${remoteDir}: ${error instanceof Error ? error.message : String(error)}`
    )
  }

  for (const entry of listing) {
    if (entry.name === '.' || entry.name === '..') {
      continue
    }
    const full = joinRemotePath(remoteDir, entry.name)
    // basic-ftp: isDirectory / isFile
    if (entry.isDirectory) {
      await walk(client, full, remoteRoot, out)
      continue
    }
    if (!entry.isFile) {
      continue
    }
    const relativePath = toRelativeRemotePath(remoteRoot, full)
    if (!relativePath) {
      continue
    }
    out.push({
      relativePath,
      remotePath: full,
      size: entry.size ?? 0,
      mtime: entry.modifiedAt ?? null
    })
  }
}

export const ftpSourceAdapter: SourceAdapter = {
  kind: 'ftp',

  async listFiles(profile: ResolvedProfile, remoteRoot: string): Promise<SourceListResult> {
    const root = normalizeRemotePath(remoteRoot || profile.options.remotePath || '.')
    return withFtp(profile, async (client) => {
      const files: RemoteFileInfo[] = []
      await walk(client, root, root, files)
      return { files, remoteRoot: root }
    })
  },

  async downloadFiles(
    profile: ResolvedProfile,
    files: RemoteFileInfo[],
    localDir: string
  ): Promise<SourceDownloadResult> {
    return withFtp(profile, async (client) => {
      let bytes = 0
      let fileCount = 0
      for (const file of files) {
        const localPath = toOsPath(join(localDir, ...file.relativePath.split('/')))
        mkdirSync(dirname(localPath), { recursive: true })
        await client.downloadTo(localPath, file.remotePath)
        bytes += file.size
        fileCount += 1
      }
      return { bytes, fileCount }
    })
  }
}
