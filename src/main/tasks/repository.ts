import { randomUUID } from 'crypto'
import { desc, eq } from 'drizzle-orm'
import { getNextRunAt, normalizeSchedule } from '../../shared/schedule'
import {
  TaskCreateSchema,
  TaskUpdateSchema,
  type TaskCreateInput,
  type TaskDto,
  type TaskUpdateInput
} from '../../shared/tasks'
import { getOrm } from '../db/client'
import { profiles, taskRuns, tasks } from '../db/schema'
import { parseTaskSettings, serializeTaskSettings } from './settingsStorage'

function toDto(row: typeof tasks.$inferSelect): TaskDto {
  const profile = getOrm().select().from(profiles).where(eq(profiles.id, row.profileId)).get()
  const schedule = normalizeSchedule(JSON.parse(row.scheduleJson))
  const { settings, hasArchivePassword } = parseTaskSettings(row.settingsJson)
  const last = getOrm()
    .select()
    .from(taskRuns)
    .where(eq(taskRuns.taskId, row.id))
    .orderBy(desc(taskRuns.createdAt))
    .limit(1)
    .get()

  return {
    id: row.id,
    name: row.name,
    profileId: row.profileId,
    profileName: profile?.name ?? null,
    profileType: profile?.type ?? null,
    targetFolder: row.targetFolder,
    schedule,
    settings,
    enabled: row.enabled,
    catchUpMissed: row.catchUpMissed,
    hasArchivePassword,
    nextRunAt: row.enabled ? getNextRunAt(schedule) : null,
    lastRunAt: last?.startedAt ?? last?.createdAt ?? null,
    lastRunStatus: last?.status ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  }
}

export function listTasks(): TaskDto[] {
  return getOrm()
    .select()
    .from(tasks)
    .all()
    .map((row) => toDto(row))
    .sort((a, b) => a.name.localeCompare(b.name))
}

export function getTaskDto(id: string): TaskDto | null {
  const row = getOrm().select().from(tasks).where(eq(tasks.id, id)).get()
  return row ? toDto(row) : null
}

export function getTaskRow(id: string): typeof tasks.$inferSelect | null {
  return getOrm().select().from(tasks).where(eq(tasks.id, id)).get() ?? null
}

function assertProfileExists(profileId: string): void {
  const profile = getOrm().select().from(profiles).where(eq(profiles.id, profileId)).get()
  if (!profile) {
    throw new Error('Source profile not found')
  }
}

export function createTask(input: TaskCreateInput): TaskDto {
  const data = TaskCreateSchema.parse(input)
  assertProfileExists(data.profileId)
  const schedule = normalizeSchedule(data.schedule)
  const now = new Date().toISOString()
  const id = randomUUID()
  const settingsJson = serializeTaskSettings(
    data.settings,
    data.archivePassword,
    null,
    false
  )

  getOrm()
    .insert(tasks)
    .values({
      id,
      name: data.name,
      profileId: data.profileId,
      targetFolder: data.targetFolder,
      scheduleJson: JSON.stringify(schedule),
      settingsJson,
      enabled: data.enabled,
      catchUpMissed: data.catchUpMissed,
      createdAt: now,
      updatedAt: now
    })
    .run()

  const created = getTaskDto(id)
  if (!created) {
    throw new Error('Failed to load task after create')
  }
  return created
}

export function updateTask(input: TaskUpdateInput): TaskDto {
  const data = TaskUpdateSchema.parse(input)
  const existing = getTaskRow(data.id)
  if (!existing) {
    throw new Error('Task not found')
  }

  if (data.profileId) {
    assertProfileExists(data.profileId)
  }

  const parsedExisting = parseTaskSettings(existing.settingsJson)
  const schedule = data.schedule
    ? normalizeSchedule(data.schedule)
    : normalizeSchedule(JSON.parse(existing.scheduleJson))

  const settingsJson = data.settings
    ? serializeTaskSettings(
        data.settings,
        data.archivePassword,
        parsedExisting.archivePasswordEncrypted,
        data.clearArchivePassword
      )
    : data.archivePassword || data.clearArchivePassword
      ? serializeTaskSettings(
          parsedExisting.settings,
          data.archivePassword,
          parsedExisting.archivePasswordEncrypted,
          data.clearArchivePassword
        )
      : existing.settingsJson

  const now = new Date().toISOString()
  getOrm()
    .update(tasks)
    .set({
      name: data.name ?? existing.name,
      profileId: data.profileId ?? existing.profileId,
      targetFolder: data.targetFolder ?? existing.targetFolder,
      scheduleJson: JSON.stringify(schedule),
      settingsJson,
      enabled: data.enabled ?? existing.enabled,
      catchUpMissed: data.catchUpMissed ?? existing.catchUpMissed,
      updatedAt: now
    })
    .where(eq(tasks.id, data.id))
    .run()

  const updated = getTaskDto(data.id)
  if (!updated) {
    throw new Error('Failed to load task after update')
  }
  return updated
}

export function deleteTask(id: string): void {
  const result = getOrm().delete(tasks).where(eq(tasks.id, id)).run()
  if (result.changes === 0) {
    throw new Error('Task not found')
  }
}

export function listEnabledTaskRows(): Array<typeof tasks.$inferSelect> {
  return getOrm().select().from(tasks).all().filter((row) => row.enabled)
}
