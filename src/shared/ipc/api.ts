import type {
  ConnectionTestResult,
  ProfileCreateInput,
  ProfileDto,
  ProfileTestInput,
  ProfileUpdateInput,
  SshHostKeyDecision,
  SshHostKeyPrompt
} from '../profiles'
import type { DriverStatus, DriverToolId } from '../drivers'
import type {
  CycleRestoreDto,
  RestoreBrowseResult,
  RestoreFilesResult,
  RestoreVerifyResult
} from '../restore'
import type { RunLogResponse, RunProgress, TaskRunDto } from '../runs'
import type { AppSettings } from '../settings'
import type {
  DashboardScheduleItem,
  SchedulePreview,
  TaskCreateInput,
  TaskDto,
  TaskSchedule,
  TaskUpdateInput
} from '../tasks'
import type { AppInfo, AppPaths, DbHealth } from './schemas'

export type RunLogLineEvent = {
  runId: string
  line: string
  at: string
}

export type DriverInstallProgress = {
  toolId: DriverToolId
  phase: 'download' | 'extract' | 'done'
  receivedBytes: number
  totalBytes: number | null
}

/**
 * Typed surface exposed to the renderer via preload `contextBridge`.
 * Every method maps 1:1 to a validated IPC channel.
 */
export interface BackupHubApi {
  getAppInfo: () => Promise<AppInfo>
  getAppPaths: () => Promise<AppPaths>
  quit: () => Promise<void>
  showMainWindow: () => Promise<void>
  hideToTray: () => Promise<void>
  getDbHealth: () => Promise<DbHealth>
  getAllSettings: () => Promise<AppSettings>
  getSetting: <K extends keyof AppSettings>(key: K) => Promise<AppSettings[K]>
  setSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => Promise<AppSettings>
  setSettings: (values: Partial<AppSettings>) => Promise<AppSettings>

  listProfiles: () => Promise<ProfileDto[]>
  getProfile: (id: string) => Promise<ProfileDto>
  createProfile: (input: ProfileCreateInput) => Promise<ProfileDto>
  updateProfile: (input: ProfileUpdateInput) => Promise<ProfileDto>
  deleteProfile: (id: string) => Promise<{ ok: true }>
  testProfile: (input: ProfileTestInput) => Promise<ConnectionTestResult>
  decideSshHostKey: (decision: SshHostKeyDecision) => Promise<{ ok: true }>
  onSshHostKeyPrompt: (handler: (prompt: SshHostKeyPrompt) => void) => () => void

  listTasks: () => Promise<TaskDto[]>
  getTask: (id: string) => Promise<TaskDto>
  createTask: (input: TaskCreateInput) => Promise<TaskDto>
  updateTask: (input: TaskUpdateInput) => Promise<TaskDto>
  deleteTask: (id: string) => Promise<{ ok: true }>
  runTaskNow: (
    id: string,
    options?: { dryRun?: boolean }
  ) => Promise<{ ok: true; runId: string; dryRun: boolean }>
  listTaskRuns: (limit?: number) => Promise<TaskRunDto[]>
  getTaskRun: (id: string) => Promise<TaskRunDto & { latestProgress: RunProgress | null }>
  getTaskRunLog: (id: string) => Promise<RunLogResponse>
  onRunProgress: (handler: (progress: RunProgress) => void) => () => void
  onRunLogLine: (handler: (event: RunLogLineEvent) => void) => () => void
  previewSchedule: (schedule: TaskSchedule, count?: number) => Promise<SchedulePreview>
  listUpcomingRuns: (limit?: number) => Promise<DashboardScheduleItem[]>
  pickDirectory: () => Promise<{ path: string | null }>

  listDrivers: () => Promise<DriverStatus[]>
  installDriver: (toolId: DriverToolId) => Promise<DriverStatus>
  onDriverProgress: (handler: (progress: DriverInstallProgress) => void) => () => void

  listRestoreTasks: () => Promise<
    Array<{ id: string; name: string; targetFolder: string; profileName: string | null }>
  >
  listRestoreCycles: (taskId: string) => Promise<CycleRestoreDto[]>
  browseRestoreCycle: (cycleId: string, asOfStamp?: string) => Promise<RestoreBrowseResult>
  restoreCycleFiles: (input: {
    cycleId: string
    destPath: string
    asOfStamp?: string
    paths?: string[]
  }) => Promise<RestoreFilesResult>
  verifyRestoreArchive: (cycleId: string) => Promise<RestoreVerifyResult>
}

export type BackupHubApiMethod = keyof BackupHubApi
