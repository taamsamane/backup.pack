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
  TASKS_GET_RUN: 'tasks:getRun',
  TASKS_GET_RUN_LOG: 'tasks:getRunLog',
  /** Main → renderer: live run progress */
  TASKS_RUN_PROGRESS: 'tasks:runProgress',
  /** Main → renderer: live log line */
  TASKS_RUN_LOG_LINE: 'tasks:runLogLine',
  TASKS_PREVIEW_SCHEDULE: 'tasks:previewSchedule',
  TASKS_UPCOMING: 'tasks:upcoming',
  DIALOG_PICK_DIRECTORY: 'dialog:pickDirectory',
  DRIVERS_LIST: 'drivers:list',
  DRIVERS_INSTALL: 'drivers:install',
  /** Main → renderer progress event */
  DRIVERS_PROGRESS: 'drivers:progress',
  RESTORE_LIST_TASKS: 'restore:listTasks',
  RESTORE_LIST_CYCLES: 'restore:listCycles',
  RESTORE_BROWSE: 'restore:browse',
  RESTORE_FILES: 'restore:files',
  RESTORE_VERIFY: 'restore:verify'
} as const

export type IpcChannel = (typeof IpcChannels)[keyof typeof IpcChannels]
