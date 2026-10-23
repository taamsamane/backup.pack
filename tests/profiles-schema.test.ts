import { describe, expect, it } from 'vitest'
import { ProfileCreateSchema, ProfileCredentialsSchema } from '../src/shared/profiles'

describe('ProfileCreateSchema', () => {
  it('accepts an SFTP password profile', () => {
    const parsed = ProfileCreateSchema.parse({
      name: 'prod-sftp',
      type: 'sftp',
      host: 'files.example.com',
      port: 22,
      username: 'backup',
      authMethod: 'password',
      credentials: { password: 'secret' }
    })
    expect(parsed.name).toBe('prod-sftp')
  })

  it('requires filePath for sqlite', () => {
    expect(() =>
      ProfileCreateSchema.parse({
        name: 'local-db',
        type: 'sqlite',
        authMethod: 'none'
      })
    ).toThrow()
  })

  it('requires aws keys when authMethod is aws-keys', () => {
    expect(() =>
      ProfileCreateSchema.parse({
        name: 's3',
        type: 'aws-s3',
        authMethod: 'aws-keys',
        credentials: { accessKeyId: 'AKIA' }
      })
    ).toThrow()
  })

  it('parses credentials strictly', () => {
    expect(() =>
      ProfileCredentialsSchema.parse({ password: 'x', unexpected: true })
    ).toThrow()
  })

  it('allows MySQL with sshTunnelProfileId', () => {
    const parsed = ProfileCreateSchema.parse({
      name: 'mysql-via-ssh',
      type: 'mysql',
      host: '127.0.0.1',
      port: 3306,
      username: 'root',
      authMethod: 'password',
      credentials: { password: 'secret' },
      options: { sshTunnelProfileId: '550e8400-e29b-41d4-a716-446655440000' }
    })
    expect(parsed.options?.sshTunnelProfileId).toBe('550e8400-e29b-41d4-a716-446655440000')
  })

  it('rejects SSH tunnel on non-database profiles', () => {
    expect(() =>
      ProfileCreateSchema.parse({
        name: 'ftp-bad',
        type: 'ftp',
        host: 'ftp.example.com',
        authMethod: 'password',
        credentials: { password: 'x' },
        options: { sshTunnelProfileId: '550e8400-e29b-41d4-a716-446655440000' }
      })
    ).toThrow()
  })
})
