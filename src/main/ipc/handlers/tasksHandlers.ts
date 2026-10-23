import { dialog } from 'electron'
import { IpcChannels } from '../../../shared/ipc/channels'
import { EmptyPayloadSchema } from '../../../shared/ipc/schemas'
import { previewSchedule } from '../../../shared/schedule'
import {
  SchedulePreviewRequestSchema,
  TaskCreateSchema,
  TaskIdSchema,
  TaskRunNowSchema,
  TaskUpdateSchema
} from '../../../shared/tasks'
import { readRunLog } from '../../backup/runLog'
import { getLatestRunProgress } from '../../backup/runProgress'
import { getRunDto, listRecentRuns } from '../../backup/runsRepo'
import { getMainWindow } from '../../app/window'
import { TaskRunIdSchema } from '../../../shared/runs'
import { parseIpcPayload } from '../../security/ipcValidate'
import {
  createTask,
  deleteTask,
  getTaskDto,
  listTasks,
  updateTask
} from '../../tasks/repository'
import {
  enqueueScheduledRun,
  listUpcomingRuns,
  rescheduleTask,
  unscheduleTask
} from '../../tasks/scheduler'
import type { IpcRegistrar } from '../register'
import { z } from 'zod'

const UpcomingPayloadSchema = z.union([
  EmptyPayloadSchema,
  z.object({
    limit: z.number().int().min(1).max(50).default(20)
  })
])

export function registerTasksHandlers(register: IpcRegistrar): void {
  register(IpcChannels.TASKS_LIST, async (payload) => {
    parseIpcPayload(IpcChannels.TASKS_LIST, EmptyPayloadSchema, payload)
    return listTasks()
  })

  register(IpcChannels.TASKS_GET, async (payload) => {
    const { id } = parseIpcPayload(IpcChannels.TASKS_GET, TaskIdSchema, payload)
    const task = getTaskDto(id)
    if (!task) {
      throw new Error('Task not found')
    }
    return task
  })

  register(IpcChannels.TASKS_CREATE, async (payload) => {
    const data = parseIpcPayload(IpcChannels.TASKS_CREATE, TaskCreateSchema, payload)
    const task = createTask(data)
    rescheduleTask(task.id)
    return task
  })

  register(IpcChannels.TASKS_UPDATE, async (payload) => {
    const data = parseIpcPayload(IpcChannels.TASKS_UPDATE, TaskUpdateSchema, payload)
    const task = updateTask(data)
    rescheduleTask(task.id)
    return task
  })

  register(IpcChannels.TASKS_DELETE, async (payload) => {
    const { id } = parseIpcPayload(IpcChannels.TASKS_DELETE, TaskIdSchema, payload)
    unscheduleTask(id)
    deleteTask(id)
    return { ok: true }
  })

  register(IpcChannels.TASKS_RUN_NOW, async (payload) => {
    const data = parseIpcPayload(IpcChannels.TASKS_RUN_NOW, TaskRunNowSchema, payload)
    const runId = enqueueScheduledRun(data.id, 'manual', { dryRun: data.dryRun })
    return { ok: true as const, runId, dryRun: data.dryRun }
  })

  register(IpcChannels.TASKS_LIST_RUNS, async (payload) => {
    const parsed = parseIpcPayload(
      IpcChannels.TASKS_LIST_RUNS,
      z.union([
        EmptyPayloadSchema,
        z.object({ limit: z.number().int().min(1).max(500).default(100) })
      ]),
      payload
    )
    const limit =
      parsed && typeof parsed === 'object' && parsed !== null && 'limit' in parsed
        ? Number(parsed.limit ?? 100)
        : 100
    return listRecentRuns(limit)
  })

  register(IpcChannels.TASKS_GET_RUN, async (payload) => {
    const { id } = parseIpcPayload(IpcChannels.TASKS_GET_RUN, TaskRunIdSchema, payload)
    const run = getRunDto(id)
    if (!run) {
      throw new Error('Run not found')
    }
    return {
      ...run,
      latestProgress: getLatestRunProgress(id)
    }
  })

  register(IpcChannels.TASKS_GET_RUN_LOG, async (payload) => {
    const { id } = parseIpcPayload(IpcChannels.TASKS_GET_RUN_LOG, TaskRunIdSchema, payload)
    const run = getRunDto(id)
    if (!run) {
      throw new Error('Run not found')
    }
    const log = readRunLog(id)
    return {
      runId: id,
      logPath: log.path ?? run.logPath,
      content: log.content,
      exists: log.exists || Boolean(run.logPath)
    }
  })

  register(IpcChannels.TASKS_PREVIEW_SCHEDULE, async (payload) => {
    const data = parseIpcPayload(
      IpcChannels.TASKS_PREVIEW_SCHEDULE,
      SchedulePreviewRequestSchema,
      payload
    )
    return previewSchedule(data.schedule, data.count)
  })

  register(IpcChannels.TASKS_UPCOMING, async (payload) => {
    const parsed = parseIpcPayload(IpcChannels.TASKS_UPCOMING, UpcomingPayloadSchema, payload)
    const limit =
      parsed && typeof parsed === 'object' && parsed !== null && 'limit' in parsed
        ? Number(parsed.limit ?? 20)
        : 20
    return listUpcomingRuns(limit)
  })

  register(IpcChannels.DIALOG_PICK_DIRECTORY, async (payload) => {
    parseIpcPayload(IpcChannels.DIALOG_PICK_DIRECTORY, EmptyPayloadSchema, payload)
    const win = getMainWindow()
    const options = {
      properties: ['openDirectory', 'createDirectory'] as Array<
        'openDirectory' | 'createDirectory'
      >
    }
    const result = win
      ? await dialog.showOpenDialog(win, options)
      : await dialog.showOpenDialog(options)
    if (result.canceled || result.filePaths.length === 0) {
      return { path: null as string | null }
    }
    return { path: result.filePaths[0]! }
  })
}
