import { BrowserWindow, shell } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import icon from '../../../resources/icon.png?asset'
import { getLogger } from '../logging/logger'
import { getSettingFromDb } from '../db/database'

let mainWindow: BrowserWindow | null = null
let intentionallyQuitting = false

export function setIntentionallyQuitting(value: boolean): void {
  intentionallyQuitting = value
}

export function isIntentionallyQuitting(): boolean {
  return intentionallyQuitting
}

export function getMainWindow(): BrowserWindow | null {
  return mainWindow
}

export function createMainWindow(): BrowserWindow {
  const log = getLogger('window')

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    show: false,
    autoHideMenuBar: true,
    title: 'BackupHub',
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      // contextIsolation + no Node in the renderer remain mandatory.
      // Electron's process sandbox must stay false with electron-vite's bundled
      // CJS preload — sandbox:true silently fails preload load, so window.backupHub
      // is undefined. (Electron 20+ defaults sandbox to true if omitted.)
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: true
    }
  })

  mainWindow.webContents.on('preload-error', (_event, preloadPath, error) => {
    log.error({ preloadPath, err: String(error) }, 'Preload script failed')
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
    log.info('Main window ready')
  })

  mainWindow.on('minimize', () => {
    try {
      if (getSettingFromDb('minimizeToTray')) {
        mainWindow?.hide()
        log.info('Main window minimized to tray')
      }
    } catch {
      // ignore
    }
  })

  mainWindow.on('close', (event) => {
    if (intentionallyQuitting) {
      return
    }

    try {
      const closeToTray = getSettingFromDb('closeToTray')
      if (closeToTray) {
        event.preventDefault()
        mainWindow?.hide()
        log.info('Main window hidden to tray')
      }
    } catch {
      // Settings may be unavailable during early shutdown; allow close.
    }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    void shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    void mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return mainWindow
}

export function showMainWindow(): void {
  if (!mainWindow) {
    createMainWindow()
    return
  }
  if (mainWindow.isMinimized()) {
    mainWindow.restore()
  }
  mainWindow.show()
  mainWindow.focus()
  if (process.platform === 'win32' || process.platform === 'linux') {
    mainWindow.setSkipTaskbar(false)
  }
}

export function hideMainWindowToTray(): void {
  mainWindow?.hide()
}
