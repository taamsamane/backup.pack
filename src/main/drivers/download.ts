import { createWriteStream } from 'fs'
import http from 'http'
import https from 'https'
import type { IncomingMessage } from 'http'
import { URL } from 'url'
import { pipeline } from 'stream/promises'
import { Transform } from 'stream'

export type DownloadProgress = {
  receivedBytes: number
  totalBytes: number | null
}

function formatDownloadError(url: string, error: unknown): Error {
  const err = error as NodeJS.ErrnoException & { cause?: unknown }
  const code = err.code ? ` [${err.code}]` : ''
  const cause =
    err.cause instanceof Error
      ? err.cause.message
      : typeof err.cause === 'string'
        ? err.cause
        : ''
  const detail = [err.message, cause].filter(Boolean).join(' — ')
  return new Error(
    `Download failed${code}: ${detail || 'network error'} (${url}). Check internet access and that drivers.taam.shop is reachable.`
  )
}

function requestOnce(url: string, redirectsLeft: number): Promise<IncomingMessage> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url)
    const lib = parsed.protocol === 'http:' ? http : https
    const req = lib.get(
      url,
      {
        headers: {
          'User-Agent': 'BackupHub-DriverManager/0.1',
          Accept: '*/*'
        },
        timeout: 120_000
      },
      (res) => {
        const status = res.statusCode ?? 0
        if ([301, 302, 303, 307, 308].includes(status) && res.headers.location) {
          res.resume()
          if (redirectsLeft <= 0) {
            reject(new Error(`Too many redirects for ${url}`))
            return
          }
          const next = new URL(res.headers.location, url).toString()
          void requestOnce(next, redirectsLeft - 1).then(resolve, reject)
          return
        }
        if (status < 200 || status >= 300) {
          res.resume()
          reject(new Error(`HTTP ${status} for ${url}`))
          return
        }
        resolve(res)
      }
    )
    req.on('timeout', () => {
      req.destroy(new Error('Connection timed out'))
    })
    req.on('error', reject)
  })
}

/**
 * Stream a URL to a local file using Node https/http (more reliable than Electron fetch).
 */
export async function downloadToFile(
  url: string,
  destPath: string,
  onProgress?: (p: DownloadProgress) => void
): Promise<{ receivedBytes: number; totalBytes: number | null }> {
  try {
    const res = await requestOnce(url, 5)
    const totalBytes = Number(res.headers['content-length'] || 0) || null
    let receivedBytes = 0

    const counter = new Transform({
      transform(chunk, _enc, cb) {
        const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
        receivedBytes += buf.length
        onProgress?.({ receivedBytes, totalBytes })
        cb(null, buf)
      }
    })

    await pipeline(res, counter, createWriteStream(destPath))
    return { receivedBytes, totalBytes }
  } catch (error) {
    throw formatDownloadError(url, error)
  }
}
