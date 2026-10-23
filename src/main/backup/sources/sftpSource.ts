import { mkdirSync } from 'fs'
import { dirname, join } from 'path'
import SftpClient from 'ssh2-sftp-client'
import {
  joinRemotePath,
  normalizeRemotePath,
  toRelativeRemotePath
} from '../../../shared/backup/remotePath'
import { toOsPath } from '../../../shared/paths'
import { buildSshConnectConfig } from '../../profiles/sshConnection'
import type { ResolvedProfile } from '../../profiles/testers/types'
import type { RemoteFileInfo, SourceAdapter, SourceDownloadResult, SourceListResult } from './types'

type SftpListEntry = {
  name: string
  type: string
  size: number
  modifyTime: number
}

function asSshProfile(profile: ResolvedProfile): ResolvedProfile {
  return {
    ...profile,
    type: profile.type === 'ssh' ? 'ssh' : 'sftp'
  }
}

async function walk(
  sftp: SftpClient,
  remoteDir: string,
  remoteRoot: string,
  out: RemoteFileInfo[]
): Promise<void> {
  const listing = (await sftp.list(remoteDir)) as SftpListEntry[]
  for (const entry of listing) {
    if (entry.name === '.' || entry.name === '..') {
      continue
    }
    const full = joinRemotePath(remoteDir, entry.name)
    if (entry.type === 'd') {
      await walk(sftp, full, remoteRoot, out)
      continue
    }
    if (entry.type !== '-') {
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
      mtime: entry.modifyTime ? new Date(entry.modifyTime) : null
    })
  }
}

export const sftpSourceAdapter: SourceAdapter = {
  kind: 'sftp',

  async listFiles(profile: ResolvedProfile, remoteRoot: string): Promise<SourceListResult> {
    const root = normalizeRemotePath(remoteRoot || profile.options.remotePath || '.')
    const sftp = new SftpClient()
    const options = buildSshConnectConfig(asSshProfile(profile))

    try {
      await sftp.connect(options)
      const files: RemoteFileInfo[] = []
      await walk(sftp, root, root, files)
      return { files, remoteRoot: root }
    } finally {
      await sftp.end().catch(() => undefined)
    }
  },

  async downloadFiles(
    profile: ResolvedProfile,
    files: RemoteFileInfo[],
    localDir: string
  ): Promise<SourceDownloadResult> {
    const sftp = new SftpClient()
    const options = buildSshConnectConfig(asSshProfile(profile))

    let bytes = 0
    let fileCount = 0
    try {
      await sftp.connect(options)
      for (const file of files) {
        const localPath = toOsPath(join(localDir, ...file.relativePath.split('/')))
        mkdirSync(dirname(localPath), { recursive: true })
        await sftp.fastGet(file.remotePath, localPath)
        bytes += file.size
        fileCount += 1
      }
    } finally {
      await sftp.end().catch(() => undefined)
    }
    return { bytes, fileCount }
  }
}
