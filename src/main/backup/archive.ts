import { createWriteStream, existsSync } from 'fs'
import { readdir, stat } from 'fs/promises'
import { join } from 'path'
import { ZipArchive } from 'archiver'
import { joinOsPath } from '../../shared/paths'
import { getLogger } from '../logging/logger'

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
 * Zip a cycle directory into archives/. Uses archiver (deflate).
 * Password encryption is deferred until 7-Zip driver integration (Phase 7/9).
 */
export async function zipCycleFolder(input: {
  cyclePath: string
  archivePath: string
  password: string | null
}): Promise<{ bytes: number; fileCount: number }> {
  if (!existsSync(input.cyclePath)) {
    throw new Error(`Cycle folder missing: ${input.cyclePath}`)
  }
  if (input.password) {
    getLogger('archive').warn(
      'Archive password set but AES zip via archiver is unavailable; writing unencrypted zip (7-Zip encryption lands with Driver Manager)'
    )
  }

  const files = await walkFiles(input.cyclePath)
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
