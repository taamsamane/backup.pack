/** Safe folder segment from a task name (no path separators). */
export function sanitizeTaskFolderName(name: string): string {
  const cleaned = name
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')
    .replace(/\s+/g, ' ')
    .replace(/^\.+/, '_')
    .slice(0, 120)
  return cleaned.length > 0 ? cleaned : 'task'
}
