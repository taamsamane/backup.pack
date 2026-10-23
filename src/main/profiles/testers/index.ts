import type { ConnectionTestResult, ProfileCreateInput } from '../../../shared/profiles'
import { ProfileCreateSchema, ProfileOptionsSchema } from '../../../shared/profiles'
import { getLogger } from '../../logging/logger'
import { loadProfileForConnection } from '../repository'
import { testAwsS3Connection } from './awsS3'
import { testFtpConnection } from './ftp'
import { testMongodbConnection } from './mongodb'
import { testMssqlConnection } from './mssql'
import { testMysqlConnection } from './mysql'
import { testPostgresConnection } from './postgres'
import { testSftpConnection, testSshConnection } from './sshSftp'
import { testSqliteConnection } from './sqlite'
import type { ConnectionTester, ResolvedProfile } from './types'

const testers: Record<ResolvedProfile['type'], ConnectionTester> = {
  sftp: testSftpConnection,
  ftp: testFtpConnection,
  ssh: testSshConnection,
  mysql: testMysqlConnection,
  mariadb: testMysqlConnection,
  postgres: testPostgresConnection,
  mssql: testMssqlConnection,
  mongodb: testMongodbConnection,
  sqlite: testSqliteConnection,
  'aws-s3': testAwsS3Connection
}

function fromSavedId(id: string): ResolvedProfile {
  const loaded = loadProfileForConnection(id)
  return {
    type: loaded.row.type,
    name: loaded.row.name,
    host: loaded.row.host,
    port: loaded.row.port,
    username: loaded.row.username,
    authMethod: loaded.row.authMethod,
    credentials: loaded.credentials,
    options: loaded.options
  }
}

function fromDraft(input: ProfileCreateInput): ResolvedProfile {
  const data = ProfileCreateSchema.parse(input)
  return {
    type: data.type,
    name: data.name,
    host: data.host ?? null,
    port: data.port ?? null,
    username: data.username ?? null,
    authMethod: data.authMethod,
    credentials: data.credentials ?? {},
    options: ProfileOptionsSchema.parse(data.options ?? {})
  }
}

export async function testConnection(
  input: { id: string } | ProfileCreateInput
): Promise<ConnectionTestResult> {
  const log = getLogger('connectionTest')
  const profile = 'id' in input ? fromSavedId(input.id) : fromDraft(input)
  const tester = testers[profile.type]

  try {
    const result = await tester(profile)
    log.info(
      { type: profile.type, name: profile.name, ok: result.ok, latencyMs: result.latencyMs },
      'Connection test finished'
    )
    return result
  } catch (error) {
    let message = error instanceof Error ? error.message : String(error)
    if (/Timed out while waiting for handshake/i.test(message) && message.length < 80) {
      message = `${message}. For SSH/SFTP or DB-via-SSH: verify host/port, credentials, and click Trust on the host-key dialog if shown.`
    }
    log.warn({ type: profile.type, name: profile.name, err: message }, 'Connection test failed')
    return {
      ok: false,
      message,
      latencyMs: 0
    }
  }
}
