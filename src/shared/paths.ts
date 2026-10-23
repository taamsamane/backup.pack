import { join, normalize, sep } from 'path'

/**
 * Normalize a filesystem path for the current OS.
 * On Windows, prefixes long paths with `\\?\` when needed (> 240 chars).
 */
export function toOsPath(inputPath: string): string {
  const normalized = normalize(inputPath)
  if (process.platform !== 'win32') {
    return normalized
  }

  if (normalized.startsWith('\\\\?\\') || normalized.startsWith('\\\\.\\')) {
    return normalized
  }

  // UNC path: \\server\share\...
  if (normalized.startsWith('\\\\')) {
    if (normalized.length > 240) {
      return `\\\\?\\UNC\\${normalized.slice(2)}`
    }
    return normalized
  }

  if (normalized.length > 240) {
    return `\\\\?\\${normalized}`
  }

  return normalized
}

/** Join path segments then apply OS-specific long-path handling. */
export function joinOsPath(...segments: string[]): string {
  return toOsPath(join(...segments))
}

/** Ensure trailing separator for directory paths used as prefixes. */
export function ensureTrailingSep(dirPath: string): string {
  return dirPath.endsWith(sep) ? dirPath : `${dirPath}${sep}`
}
