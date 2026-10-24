import { app, BrowserWindow } from 'electron'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { mkdirSync } from 'fs'
import { join } from 'path'
import { ensureNotificationAppName } from './app/notifications'
import { acquireSingleInstanceLock } from './app/singleInstance'
import { applyLaunchOnLogin } from './app/loginItem'
import { createTray, destroyTray } from './app/tray'
import { initAutoUpdater } from './app/updater'
import { createMainWindow, setIntentionallyQuitting } from './app/window'
import { closeDatabase, getAllSettingsFromDb, initDatabase } from './db/database'
import { registerIpcHandlers } from './ipc/register'
import { getLogger, initLogger } from './logging/logger'
import { startBackupWorker, stopBackupWorker } from './backup/worker'
import { startScheduler, stopScheduler } from './tasks/scheduler'

/**
 * Chromium's SUID chrome-sandbox often lacks root:4755 after `npm install` on Linux,
 * which aborts startup. Keep Electron renderer sandbox (contextIsolation) enabled;
 * this only skips the setuid helper. Set BACKUPHUB_ELECTRON_NO_SANDBOX=0 after fixing
 * chrome-sandbox permissions if you want the SUID helper in use.
 */
function configureLinuxChromiumSandbox(): void {
  if (process.platform !== 'linux') {
    return
  }
  if (process.env.BACKUPHUB_ELECTRON_NO_SANDBOX === '0') {
    return
  }
  app.commandLine.appendSwitch('no-sandbox')
}

configureLinuxChromiumSandbox()

if (!acquireSingleInstanceLock()) {
  app.quit()
} else {
  void bootstrap()
}

async function bootstrap(): Promise<void> {
  await app.whenReady()

  electronApp.setAppUserModelId('com.backuphub.app')

  const userData = app.getPath('userData')
  mkdirSync(join(userData, 'logs'), { recursive: true })
  mkdirSync(join(userData, 'data'), { recursive: true })
  mkdirSync(join(userData, 'drivers'), { recursive: true })

  await initLogger('info')
  const log = getLogger('main')

  try {
    initDatabase()
    const settings = getAllSettingsFromDb()
    await initLogger(settings.logLevel)
    applyLaunchOnLogin(settings.launchOnLogin)

    registerIpcHandlers()
    startScheduler()
    startBackupWorker()
    createTray()
    createMainWindow()
    ensureNotificationAppName()
    initAutoUpdater({ checkOnStartup: settings.checkUpdatesOnStartup })

    app.on('browser-window-created', (_event, window) => {
      optimizer.watchWindowShortcuts(window)
    })

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createMainWindow()
      }
    })

    log.info(
      {
        version: app.getVersion(),
        platform: process.platform,
        userData
      },
      'BackupHub started'
    )
  } catch (error) {
    log.error({ err: String(error) }, 'Failed to start BackupHub')
    setIntentionallyQuitting(true)
    app.quit()
  }
}

app.on('before-quit', () => {
  setIntentionallyQuitting(true)
})

app.on('window-all-closed', () => {
  // Keep running in the tray on all platforms while schedules are active.
  // Explicit Quit from the tray menu sets intentionallyQuitting and calls app.quit().
})

app.on('will-quit', () => {
  try {
    stopBackupWorker()
  } catch {
    // ignore
  }
  try {
    stopScheduler()
  } catch {
    // ignore
  }
  try {
    closeDatabase()
  } catch {
    // ignore
  }
  destroyTray()
})
