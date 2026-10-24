import { app } from 'electron'
import { autoUpdater } from 'electron-updater'
import { IpcChannels } from '../../shared/ipc/channels'
import type { UpdateStatus } from '../../shared/updates'
import { getLogger } from '../logging/logger'
import { notifyUpdateAvailable } from './notifications'
import { getMainWindow } from './window'

let latest: UpdateStatus = {
  state: 'idle',
  message: null,
  version: null,
  progressPercent: null
}

function emit(status: UpdateStatus): void {
  latest = status
  const win = getMainWindow()
  if (win && !win.isDestroyed()) {
    win.webContents.send(IpcChannels.APP_UPDATE_STATUS, status)
  }
}

export function getUpdateStatus(): UpdateStatus {
  return latest
}

let wired = false

/**
 * Wire electron-updater event handlers. Startup check is optional.
 */
export function initAutoUpdater(options: { checkOnStartup?: boolean } = {}): void {
  const log = getLogger('updater')
  const force = process.env.BACKUPHUB_FORCE_UPDATER === '1'
  if (!app.isPackaged && !force) {
    log.info('Auto-updater idle (dev build)')
    return
  }

  if (!wired) {
    wired = true
    autoUpdater.autoDownload = false
    autoUpdater.logger = {
      info: (m) => log.info(String(m)),
      warn: (m) => log.warn(String(m)),
      error: (m) => log.error(String(m)),
      debug: (m) => log.debug(String(m))
    }

    autoUpdater.on('checking-for-update', () => {
      emit({
        state: 'checking',
        message: 'Checking for updates…',
        version: null,
        progressPercent: null
      })
    })
    autoUpdater.on('update-available', (info) => {
      emit({
        state: 'available',
        message: `Update ${info.version} available`,
        version: info.version,
        progressPercent: null
      })
      notifyUpdateAvailable(info.version)
    })
    autoUpdater.on('update-not-available', () => {
      emit({
        state: 'not-available',
        message: 'You are on the latest version',
        version: app.getVersion(),
        progressPercent: null
      })
    })
    autoUpdater.on('error', (err) => {
      emit({
        state: 'error',
        message: err.message || String(err),
        version: null,
        progressPercent: null
      })
    })
    autoUpdater.on('download-progress', (p) => {
      emit({
        state: 'downloading',
        message: `Downloading… ${Math.round(p.percent)}%`,
        version: latest.version,
        progressPercent: Math.round(p.percent)
      })
    })
    autoUpdater.on('update-downloaded', (info) => {
      emit({
        state: 'downloaded',
        message: `Update ${info.version} downloaded — restart to install`,
        version: info.version,
        progressPercent: 100
      })
    })
  }

  if (options.checkOnStartup !== false) {
    setTimeout(() => {
      void checkForUpdates()
    }, 8_000)
  }
}

export async function checkForUpdates(): Promise<UpdateStatus> {
  const force = process.env.BACKUPHUB_FORCE_UPDATER === '1'
  if (!app.isPackaged && !force) {
    const status: UpdateStatus = {
      state: 'idle',
      message: 'Updates are only checked in packaged builds',
      version: app.getVersion(),
      progressPercent: null
    }
    emit(status)
    return status
  }
  try {
    await autoUpdater.checkForUpdates()
  } catch (error) {
    emit({
      state: 'error',
      message: error instanceof Error ? error.message : String(error),
      version: null,
      progressPercent: null
    })
  }
  return latest
}

export async function downloadUpdate(): Promise<UpdateStatus> {
  try {
    await autoUpdater.downloadUpdate()
  } catch (error) {
    emit({
      state: 'error',
      message: error instanceof Error ? error.message : String(error),
      version: latest.version,
      progressPercent: null
    })
  }
  return latest
}

export function quitAndInstallUpdate(): void {
  autoUpdater.quitAndInstall(false, true)
}
