import { app } from 'electron'
import { existsSync, mkdirSync, unlinkSync, writeFileSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'
import { getLogger } from '../logging/logger'

function autostartDir(): string {
  return join(homedir(), '.config', 'autostart')
}

function desktopFilePath(): string {
  return join(autostartDir(), 'BackupHub.desktop')
}

/**
 * Create or remove an XDG autostart `.desktop` entry (Linux).
 * Only meaningful when the app is packaged; in dev we still write a path to Electron.
 */
export function applyLinuxAutostart(enabled: boolean): void {
  const log = getLogger('linuxAutostart')
  const file = desktopFilePath()

  if (!enabled) {
    if (existsSync(file)) {
      unlinkSync(file)
      log.info({ file }, 'Removed Linux autostart entry')
    }
    return
  }

  mkdirSync(autostartDir(), { recursive: true })
  const execPath = app.isPackaged
    ? app.getPath('exe')
    : `${process.execPath} ${JSON.stringify(app.getAppPath())}`

  const contents = [
    '[Desktop Entry]',
    'Type=Application',
    'Version=1.0',
    'Name=BackupHub',
    'Comment=Scheduled backups for databases, S3, and server files',
    `Exec=${execPath}`,
    'Terminal=false',
    'Categories=Utility;',
    'X-GNOME-Autostart-enabled=true',
    ''
  ].join('\n')

  writeFileSync(file, contents, 'utf8')
  log.info({ file, packaged: app.isPackaged }, 'Wrote Linux autostart entry')
}
