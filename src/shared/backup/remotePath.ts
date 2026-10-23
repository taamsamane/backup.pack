/** Normalize remote path segments to POSIX style. */
export function normalizeRemotePath(input: string): string {
  const trimmed = input.trim().replace(/\\/g, '/')
  if (!trimmed || trimmed === '.') {
    return '.'
  }
  // Collapse duplicate slashes but keep a single leading slash for absolute paths
  const absolute = trimmed.startsWith('/')
  const parts = trimmed.split('/').filter((p) => p && p !== '.')
  const joined = parts.join('/')
  if (!joined) {
    return absolute ? '/' : '.'
  }
  return absolute ? `/${joined}` : joined
}

export function joinRemotePath(base: string, child: string): string {
  const b = normalizeRemotePath(base)
  const c = child.replace(/\\/g, '/').replace(/^\/+/, '')
  if (!c) {
    return b
  }
  if (b === '.' || b === '') {
    return c
  }
  if (b === '/') {
    return `/${c}`
  }
  return `${b.replace(/\/+$/, '')}/${c}`
}

/** Relative path from remote root for manifest keys (always `/`-separated, no leading slash). */
export function toRelativeRemotePath(root: string, fullPath: string): string {
  const r = normalizeRemotePath(root)
  const f = normalizeRemotePath(fullPath)
  if (r === '.' || r === '') {
    return f.replace(/^\.\//, '').replace(/^\//, '')
  }
  if (r === '/') {
    return f.replace(/^\//, '')
  }
  if (f === r) {
    return ''
  }
  const prefix = r.endsWith('/') ? r : `${r}/`
  if (f.startsWith(prefix)) {
    return f.slice(prefix.length)
  }
  // Fallback: basename-style
  return f.replace(/^\//, '')
}
