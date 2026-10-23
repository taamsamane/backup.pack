import type { ProfileType } from '../../../shared/profiles'
import type { ResolvedProfile } from '../../profiles/testers/types'
import { ftpSourceAdapter } from './ftpSource'
import { s3SourceAdapter } from './s3Source'
import { sftpSourceAdapter } from './sftpSource'
import type { SourceAdapter } from './types'

const ADAPTER_PHASE: Partial<Record<ProfileType, string>> = {}

export function getSourceAdapter(type: ProfileType): SourceAdapter | null {
  if (type === 'sftp' || type === 'ssh') {
    return sftpSourceAdapter
  }
  if (type === 'ftp') {
    return ftpSourceAdapter
  }
  if (type === 'aws-s3') {
    return s3SourceAdapter
  }
  return null
}

export function supportsBackupSource(type: ProfileType): boolean {
  return (
    getSourceAdapter(type) != null ||
    ['mysql', 'mariadb', 'postgres', 'mssql', 'mongodb', 'sqlite'].includes(type)
  )
}

export function adapterUnavailableMessage(type: ProfileType): string {
  const phase = ADAPTER_PHASE[type] ?? 'a later phase'
  return `Source transfer for ${type} arrives in ${phase}.`
}

export function resolveRemoteRoot(profile: ResolvedProfile): string {
  if (profile.type === 'aws-s3') {
    const prefix = profile.options.remotePath?.trim()
    return prefix && prefix !== '.' ? prefix : ''
  }
  return profile.options.remotePath?.trim() || '.'
}

export type { SourceAdapter, RemoteFileInfo } from './types'
export { remoteFileToManifestEntry } from './types'
