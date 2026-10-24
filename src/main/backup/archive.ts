import { createWriteStream, existsSync, mkdirSync, rmSync, statSync } from 'fs'
import { readdir, stat } from 'fs/promises'
import { basename, dirname, join } from 'path'
import { ZipArchive } from 'archiver'
import extractZip from 'extract-zip'
import yauzl from 'yauzl'
import { joinOsPath } from '../../shared/paths'
import { requireDriverBinary } from '../drivers/resolve'
import { getLogger } from '../logging/logger'
import { spawnToolOrThrow } from './spawnTool'

async function walkFiles(root: string, base = root): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true })
  const files: string[] = []
  for (const entry of entries) {
    const full = join(root, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await walkFiles(full, base)))
    } else if (entry.isFile()) {
      files.push(full)
    }
  }
  return files
}

/**
 * Zip a cycle directory into archives/.
 * With a password, uses the installed 7-Zip driver (AES-256 zip).
 * Without a password, uses archiver (deflate).
 */
export async function zipCycleFolder(input: {
  cyclePath: string
  archivePath: string
  password: string | null
}): Promise<{ bytes: number; fileCount: number }> {
  if (!existsSync(input.cyclePath)) {
    throw new Error(`Cycle folder missing: ${input.cyclePath}`)
  }

  const files = await walkFiles(input.cyclePath)
  mkdirSync(dirname(input.archivePath), { recursive: true })
  if (existsSync(input.archivePath)) {
    rmSync(input.archivePath, { force: true })
  }

  if (input.password) {
    // 7-Zip requires -p on argv; spawnTool never logs args. Install 7-Zip from Drivers first.
    const binName = process.platform === 'win32' ? '7z.exe' : '7zz'
    const bin = requireDriverBinary('7zip', binName)
    await spawnToolOrThrow({
      bin,
      args: [
        'a',
        '-tzip',
        '-mem=AES256',
        `-p${input.password}`,
        '-y',
        input.archivePath,
        basename(input.cyclePath)
      ],
      cwd: dirname(input.cyclePath),
      label: '7-Zip encrypt'
    })
    getLogger('archive').info(
      { archivePath: input.archivePath, fileCount: files.length, encrypted: true },
      'Encrypted zip written via 7-Zip'
    )
  } else {
    await new Promise<void>((resolve, reject) => {
      const output = createWriteStream(input.archivePath)
      const archive = new ZipArchive({ zlib: { level: 9 } })
      output.on('close', () => resolve())
      output.on('error', reject)
      archive.on('error', reject)
      archive.pipe(output)
      for (const file of files) {
        const name = file.slice(input.cyclePath.length).replace(/^[/\\]/, '')
        archive.file(file, { name })
      }
      void archive.finalize()
    })
  }

  const st = await stat(input.archivePath)
  return { bytes: st.size, fileCount: files.length }
}

export function archiveFileName(
  taskName: string,
  startedAt: string,
  endedAt: string
): string {
  const safe = taskName.replace(/[<>:"/\\|?*]/g, '_').slice(0, 80)
  const start = startedAt.replace(/[:.]/g, '-').slice(0, 19)
  const end = endedAt.replace(/[:.]/g, '-').slice(0, 19)
  return `${safe}_${start}_${end}.zip`
}

export function archivePathFor(archivesDirPath: string, fileName: string): string {
  return joinOsPath(archivesDirPath, fileName)
}

/**
 * Extract a cycle zip into destDir (created if needed). Zip entries are cycle-relative
 * (baseline/, changes/, manifest.json).
 */
export async function unzipCycleArchive(archivePath: string, destDir: string): Promise<void> {
  if (!existsSync(archivePath)) {
    throw new Error(`Archive not found: ${archivePath}`)
  }
  mkdirSync(destDir, { recursive: true })
  await extractZip(archivePath, { dir: destDir })
}

export type ZipVerifyResult = {
  ok: boolean
  bytes: number | null
  entryCount: number | null
  errors: string[]
}

/**
 * Open a zip and walk central directory entries.
 * Does not fully decompress every file; fails on corrupt/unreadable archives.
 */
export function verifyZipArchive(archivePath: string): Promise<ZipVerifyResult> {
  return new Promise((resolve) => {
    const errors: string[] = []
    if (!existsSync(archivePath)) {
      resolve({ ok: false, bytes: null, entryCount: null, errors: ['Archive file not found'] })
      return
    }
    let bytes: number | null = null
    try {
      bytes = statSync(archivePath).size
      if (bytes === 0) {
        resolve({ ok: false, bytes: 0, entryCount: 0, errors: ['Archive is empty (0 bytes)'] })
        return
      }
    } catch (err) {
      resolve({
        ok: false,
        bytes: null,
        entryCount: null,
        errors: [err instanceof Error ? err.message : String(err)]
      })
      return
    }

    yauzl.open(archivePath, { lazyEntries: true, autoClose: true }, (openErr, zipfile) => {
      if (openErr || !zipfile) {
        resolve({
          ok: false,
          bytes,
          entryCount: null,
          errors: [openErr?.message ?? 'Failed to open zip']
        })
        return
      }

      let entryCount = 0
      zipfile.readEntry()
      zipfile.on('entry', (entry) => {
        entryCount += 1
        if (
          entry.fileName.includes('..') ||
          entry.fileName.startsWith('/') ||
          entry.fileName.startsWith('\\')
        ) {
          errors.push(`Unsafe zip entry path: ${entry.fileName}`)
        }
        zipfile.readEntry()
      })
      zipfile.on('end', () => {
        resolve({
          ok: errors.length === 0,
          bytes,
          entryCount,
          errors
        })
      })
      zipfile.on('error', (err) => {
        errors.push(err.message)
        resolve({ ok: false, bytes, entryCount, errors })
      })
    })
  })
}
