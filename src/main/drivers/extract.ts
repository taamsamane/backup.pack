import { spawn } from 'child_process'
import { chmodSync, existsSync, mkdirSync, readdirSync, renameSync, rmSync, statSync } from 'fs'
import { join } from 'path'
import extractZip from 'extract-zip'
import { getLogger } from '../logging/logger'

async function runTarExtract(archivePath: string, destDir: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn('tar', ['-xaf', archivePath, '-C', destDir], {
      stdio: ['ignore', 'pipe', 'pipe']
    })
    let stderr = ''
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8')
    })
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`tar extract failed (${code}): ${stderr.trim() || archivePath}`))
      }
    })
  })
}

/** If extract created a single top-level folder, flatten into destDir. */
function flattenSingleRoot(destDir: string): void {
  const entries = readdirSync(destDir).filter((n) => n !== '.' && n !== '..')
  if (entries.length !== 1) {
    return
  }
  const only = join(destDir, entries[0]!)
  if (!statSync(only).isDirectory()) {
    return
  }
  const nested = readdirSync(only)
  for (const name of nested) {
    const from = join(only, name)
    const to = join(destDir, name)
    if (existsSync(to)) {
      rmSync(to, { recursive: true, force: true })
    }
    renameSync(from, to)
  }
  rmSync(only, { recursive: true, force: true })
}

function chmodBinaries(root: string): void {
  if (process.platform === 'win32') {
    return
  }
  const walk = (dir: string): void => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name)
      const st = statSync(full)
      if (st.isDirectory()) {
        walk(full)
      } else if (st.isFile() && (name === 'sqlpackage' || !name.includes('.'))) {
        try {
          chmodSync(full, 0o755)
        } catch {
          // ignore
        }
      } else if (st.isFile() && (name.endsWith('.sh') || name.includes('dump') || name.includes('sql'))) {
        try {
          chmodSync(full, 0o755)
        } catch {
          // ignore
        }
      }
    }
  }
  walk(root)
}

/**
 * Extract a downloaded driver archive into destDir (must be empty/created).
 * Supports .zip, .tar.gz, .tgz, .tar.xz. Windows 7z .exe installers are not auto-extracted.
 */
export async function extractDriverArchive(archivePath: string, destDir: string): Promise<void> {
  const log = getLogger('drivers')
  mkdirSync(destDir, { recursive: true })
  const lower = archivePath.toLowerCase()

  if (lower.endsWith('.exe')) {
    throw new Error(
      'Windows self-extracting driver installers must be run manually; use a zip/tar package when available'
    )
  }

  if (lower.endsWith('.zip')) {
    await extractZip(archivePath, { dir: destDir })
  } else if (
    lower.endsWith('.tar.gz') ||
    lower.endsWith('.tgz') ||
    lower.endsWith('.tar.xz') ||
    lower.endsWith('.tar')
  ) {
    await runTarExtract(archivePath, destDir)
  } else {
    throw new Error(`Unsupported archive type: ${archivePath}`)
  }

  flattenSingleRoot(destDir)
  // MongoDB tools often nest one more versioned folder
  flattenSingleRoot(destDir)
  chmodBinaries(destDir)
  log.info({ archivePath, destDir }, 'Driver archive extracted')
}
