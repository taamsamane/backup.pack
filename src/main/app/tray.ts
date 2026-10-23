import { Menu, Tray, nativeImage, app } from 'electron'
import { join } from 'path'
import { getLogger } from '../logging/logger'
import { hideMainWindowToTray, setIntentionallyQuitting, showMainWindow } from './window'

let tray: Tray | null = null

function resolveTrayIcon(): Electron.NativeImage {
  const candidates = [
    join(__dirname, '../../resources/icon.png'),
    join(process.resourcesPath, 'icon.png'),
    join(app.getAppPath(), 'resources', 'icon.png')
  ]

  for (const candidate of candidates) {
    const image = nativeImage.createFromPath(candidate)
    if (!image.isEmpty()) {
      return image.resize({ width: 16, height: 16 })
    }
  }

  return nativeImage.createEmpty()
}

export function createTray(): Tray {
  if (tray) {
    return tray
  }

  const log = getLogger('tray')
  const icon = resolveTrayIcon()
  tray = new Tray(icon)
  tray.setToolTip('BackupHub')

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open BackupHub',
      click: () => showMainWindow()
    },
    {
      label: 'Hide to Tray',
      click: () => hideMainWindowToTray()
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        setIntentionallyQuitting(true)
        app.quit()
      }
    }
  ])

  tray.setContextMenu(contextMenu)
  tray.on('double-click', () => showMainWindow())
  tray.on('click', () => showMainWindow())

  log.info('System tray created')
  return tray
}

export function destroyTray(): void {
  if (tray) {
    tray.destroy()
    tray = null
  }
}
