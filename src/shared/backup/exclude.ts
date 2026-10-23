/**
 * Match a relative remote path against exclude patterns.
 * Supports `*`, `?`, and `**` (globstar). Paths use `/` separators.
 */
export function matchExcludePattern(relativePath: string, pattern: string): boolean {
  const path = relativePath.replace(/\\/g, '/').replace(/^\.\//, '')
  const pat = pattern.trim().replace(/\\/g, '/')
  if (!pat) {
    return false
  }

  // Directory-style: "node_modules" or "node_modules/" matches that folder and children
  if (!pat.includes('*') && !pat.includes('?')) {
    const normalized = pat.replace(/\/+$/, '')
    return path === normalized || path.startsWith(`${normalized}/`)
  }

  const regex = globToRegExp(pat)
  return regex.test(path)
}

export function isExcluded(relativePath: string, patterns: string[]): boolean {
  return patterns.some((p) => matchExcludePattern(relativePath, p))
}

function globToRegExp(pattern: string): RegExp {
  let i = 0
  let out = '^'
  while (i < pattern.length) {
    const c = pattern[i]!
    if (c === '*' && pattern[i + 1] === '*') {
      // ** or **/
      if (pattern[i + 2] === '/') {
        out += '(?:.*/)?'
        i += 3
      } else {
        out += '.*'
        i += 2
      }
      continue
    }
    if (c === '*') {
      out += '[^/]*'
      i += 1
      continue
    }
    if (c === '?') {
      out += '[^/]'
      i += 1
      continue
    }
    if ('+.^$()[]{}|\\'.includes(c)) {
      out += `\\${c}`
    } else {
      out += c
    }
    i += 1
  }
  out += '$'
  return new RegExp(out)
}
