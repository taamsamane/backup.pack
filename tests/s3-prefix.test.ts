import { describe, expect, it } from 'vitest'
import { normalizeS3Prefix } from '../src/main/profiles/awsClient'

describe('normalizeS3Prefix', () => {
  it('treats empty / . / / as whole-bucket', () => {
    expect(normalizeS3Prefix(undefined)).toBe('')
    expect(normalizeS3Prefix('')).toBe('')
    expect(normalizeS3Prefix('.')).toBe('')
    expect(normalizeS3Prefix('/')).toBe('')
  })

  it('strips leading/trailing slashes', () => {
    expect(normalizeS3Prefix('/backups/prod/')).toBe('backups/prod')
    expect(normalizeS3Prefix('media')).toBe('media')
  })
})
