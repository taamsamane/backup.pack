import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import type { BackupHubApi } from '../shared/ipc/api'
import { IpcChannels } from '../shared/ipc/channels'
import type { SshHostKeyPrompt } from '../shared/profiles'
import type { AppSettings } from '../shared/settings'

/**
 * Sandboxed preload bridge. Renderer never gets Node or Electron internals.
 */
const api: BackupHubApi = {
  getAppInfo: () => ipcRenderer.invoke(IpcChannels.APP_GET_INFO),
  getAppPaths: () => ipcRenderer.invoke(IpcChannels.APP_GET_PATHS),
  quit: () => ipcRenderer.invoke(IpcChannels.APP_QUIT),
  showMainWindow: () => ipcRenderer.invoke(IpcChannels.APP_SHOW_MAIN_WINDOW),
  hideToTray: () => ipcRenderer.invoke(IpcChannels.WINDOW_HIDE_TO_TRAY),
  getDbHealth: () => ipcRenderer.invoke(IpcChannels.DB_HEALTH),
  getAllSettings: () => ipcRenderer.invoke(IpcChannels.SETTINGS_GET_ALL),
  getSetting: <K extends keyof AppSettings>(key: K) =>
    ipcRenderer.invoke(IpcChannels.SETTINGS_GET, { key }),
  setSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) =>
    ipcRenderer.invoke(IpcChannels.SETTINGS_SET, { key, value }),
  setSettings: (values) => ipcRenderer.invoke(IpcChannels.SETTINGS_SET_MANY, { values }),

  listProfiles: () => ipcRenderer.invoke(IpcChannels.PROFILES_LIST),
  getProfile: (id) => ipcRenderer.invoke(IpcChannels.PROFILES_GET, { id }),
  createProfile: (input) => ipcRenderer.invoke(IpcChannels.PROFILES_CREATE, input),
  updateProfile: (input) => ipcRenderer.invoke(IpcChannels.PROFILES_UPDATE, input),
  deleteProfile: (id) => ipcRenderer.invoke(IpcChannels.PROFILES_DELETE, { id }),
  testProfile: (input) => ipcRenderer.invoke(IpcChannels.PROFILES_TEST, input),
  decideSshHostKey: (decision) =>
    ipcRenderer.invoke(IpcChannels.SSH_HOST_KEY_DECISION, decision),
  onSshHostKeyPrompt: (handler) => {
    const listener = (_event: IpcRendererEvent, prompt: SshHostKeyPrompt): void => {
      handler(prompt)
    }
    ipcRenderer.on(IpcChannels.SSH_HOST_KEY_PROMPT, listener)
    return () => {
      ipcRenderer.removeListener(IpcChannels.SSH_HOST_KEY_PROMPT, listener)
    }
  },

  listTasks: () => ipcRenderer.invoke(IpcChannels.TASKS_LIST),
  getTask: (id) => ipcRenderer.invoke(IpcChannels.TASKS_GET, { id }),
  createTask: (input) => ipcRenderer.invoke(IpcChannels.TASKS_CREATE, input),
  updateTask: (input) => ipcRenderer.invoke(IpcChannels.TASKS_UPDATE, input),
  deleteTask: (id) => ipcRenderer.invoke(IpcChannels.TASKS_DELETE, { id }),
  runTaskNow: (id, options) =>
    ipcRenderer.invoke(IpcChannels.TASKS_RUN_NOW, {
      id,
      dryRun: options?.dryRun ?? false
    }),
  listTaskRuns: (limit = 100) =>
    ipcRenderer.invoke(IpcChannels.TASKS_LIST_RUNS, { limit }),
  previewSchedule: (schedule, count = 5) =>
    ipcRenderer.invoke(IpcChannels.TASKS_PREVIEW_SCHEDULE, { schedule, count }),
  listUpcomingRuns: (limit = 20) =>
    ipcRenderer.invoke(IpcChannels.TASKS_UPCOMING, { limit }),
  pickDirectory: () => ipcRenderer.invoke(IpcChannels.DIALOG_PICK_DIRECTORY)
}

contextBridge.exposeInMainWorld('backupHub', api)
