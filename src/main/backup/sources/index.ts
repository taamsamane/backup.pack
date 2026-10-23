import type { ProfileType } from '../../../shared/profiles'
import type { ResolvedProfile } from '../../profiles/testers/types'
import { ftpSourceAdapter } from './ftpSource'
import { sftpSourceAdapter } from './sftpSource'
import type { SourceAdapter } from './types'

const ADAPTER_PHASE: Partial<Record<ProfileType, string>> = {
  'aws-s3': 'Phase 6',
  mysql: 'Phase 7',
  mariadb: 'Phase 7',
  postgres: 'Phase 7',
  mssql: 'Phase 7',
  mongodb: 'Phase 7',
  sqlite: 'Phase 7'
}

export function getSourceAdapter(type: ProfileType): SourceAdapter | null {
  if (type === 'sftp' || type === 'ssh') {
    return sftpSourceAdapter
  }
  if (type === 'ftp') {
    return ftpSourceAdapter
  }
  return null
}

export function adapterUnavailableMessage(type: ProfileType): string {
  const phase = ADAPTER_PHASE[type] ?? 'a later phase'
  return `Source transfer for ${type} arrives in ${phase}.`
}

export function resolveRemoteRoot(profile: ResolvedProfile): string {
  return profile.options.remotePath?.trim() || '.'
}

export type { SourceAdapter, RemoteFileInfo } from './types'
export { remoteFileToManifestEntry } from './types'
