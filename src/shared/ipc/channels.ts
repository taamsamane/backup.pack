/**
 * Canonical IPC channel names. Main, preload, and renderer must use these constants only.
 */
export const IpcChannels = {
  APP_GET_INFO: 'app:getInfo',
  APP_GET_PATHS: 'app:getPaths',
  APP_QUIT: 'app:quit',
  APP_SHOW_MAIN_WINDOW: 'app:showMainWindow',
  DB_HEALTH: 'db:health',
  SETTINGS_GET_ALL: 'settings:getAll',
  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',
  SETTINGS_SET_MANY: 'settings:setMany',
  WINDOW_HIDE_TO_TRAY: 'window:hideToTray',
  PROFILES_LIST: 'profiles:list',
  PROFILES_GET: 'profiles:get',
  PROFILES_CREATE: 'profiles:create',
  PROFILES_UPDATE: 'profiles:update',
  PROFILES_DELETE: 'profiles:delete',
  PROFILES_TEST: 'profiles:test',
  /** Main → renderer event */
  SSH_HOST_KEY_PROMPT: 'ssh:hostKeyPrompt',
  /** Renderer → main invoke */
  SSH_HOST_KEY_DECISION: 'ssh:hostKeyDecision',
  TASKS_LIST: 'tasks:list',
  TASKS_GET: 'tasks:get',
  TASKS_CREATE: 'tasks:create',
  TASKS_UPDATE: 'tasks:update',
  TASKS_DELETE: 'tasks:delete',
  TASKS_RUN_NOW: 'tasks:runNow',
  TASKS_LIST_RUNS: 'tasks:listRuns',
  TASKS_PREVIEW_SCHEDULE: 'tasks:previewSchedule',
  TASKS_UPCOMING: 'tasks:upcoming',
  DIALOG_PICK_DIRECTORY: 'dialog:pickDirectory'
} as const

export type IpcChannel = (typeof IpcChannels)[keyof typeof IpcChannels]
