import { describe, expect, it } from 'vitest'
import {
  formatS3Error,
  normalizeS3Endpoint,
  normalizeS3Prefix
} from '../src/main/profiles/awsClient'

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

describe('normalizeS3Endpoint', () => {
  it('strips bucket subdomain from virtual-host Arvan URLs', () => {
    expect(
      normalizeS3Endpoint(
        'https://taamito-staging.s3.ir-thr-at1.arvanstorage.ir',
        'taamito-staging'
      )
    ).toBe('https://s3.ir-thr-at1.arvanstorage.ir')
  })

  it('leaves regional endpoints unchanged', () => {
    expect(
      normalizeS3Endpoint('https://s3.ir-thr-at1.arvanstorage.ir/', 'taamito-staging')
    ).toBe('https://s3.ir-thr-at1.arvanstorage.ir')
  })
})

describe('formatS3Error', () => {
  it('adds a hint for UnknownError', () => {
    const msg = formatS3Error(Object.assign(new Error('UnknownError'), { name: 'UnknownError' }))
    expect(msg).toMatch(/Arvan|MinIO|path-style/i)
  })
})
