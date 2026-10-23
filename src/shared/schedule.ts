import { Cron } from 'croner'
import type { SchedulePreview, TaskSchedule } from './tasks'
import { TaskScheduleSchema } from './tasks'

/** Build a 5-field cron expression (min hour dom month dow) from wizard fields. */
export function buildCronExpression(schedule: Omit<TaskSchedule, 'cronExpression'> & {
  cronExpression?: string
}): string {
  const minute = schedule.minute ?? 0
  const hour = schedule.hour ?? 0

  switch (schedule.mode) {
    case 'every': {
      const value = schedule.everyValue ?? 1
      if (schedule.everyUnit === 'hour') {
        return `0 */${value} * * *`
      }
      return `*/${value} * * * *`
    }
    case 'daily':
      return `${minute} ${hour} * * *`
    case 'weekly': {
      const days = [...(schedule.daysOfWeek ?? [1])].sort((a, b) => a - b).join(',')
      return `${minute} ${hour} * * ${days}`
    }
    case 'monthly':
      return `${minute} ${hour} ${schedule.dayOfMonth ?? 1} * *`
    case 'cron':
      return (schedule.cronExpression ?? '').trim()
    default:
      return '0 * * * *'
  }
}

export function normalizeSchedule(input: TaskSchedule): TaskSchedule {
  const parsed = TaskScheduleSchema.parse(input)
  const cronExpression =
    parsed.mode === 'cron' ? parsed.cronExpression.trim() : buildCronExpression(parsed)
  return TaskScheduleSchema.parse({
    ...parsed,
    cronExpression
  })
}

export function describeSchedule(schedule: TaskSchedule): string {
  const tz = schedule.timezone
  switch (schedule.mode) {
    case 'every':
      return `Every ${schedule.everyValue} ${schedule.everyUnit}${
        (schedule.everyValue ?? 1) === 1 ? '' : 's'
      } (${tz})`
    case 'daily':
      return `Daily at ${pad(schedule.hour)}:${pad(schedule.minute)} (${tz})`
    case 'weekly': {
      const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
      const days = (schedule.daysOfWeek ?? []).map((d) => names[d] ?? String(d)).join(', ')
      return `Weekly on ${days} at ${pad(schedule.hour)}:${pad(schedule.minute)} (${tz})`
    }
    case 'monthly':
      return `Monthly on day ${schedule.dayOfMonth} at ${pad(schedule.hour)}:${pad(
        schedule.minute
      )} (${tz})`
    case 'cron':
      return `Cron “${schedule.cronExpression}” (${tz})`
    default:
      return schedule.cronExpression
  }
}

function pad(value: number | undefined): string {
  return String(value ?? 0).padStart(2, '0')
}

export function previewSchedule(
  scheduleInput: TaskSchedule,
  count = 5,
  from: Date = new Date()
): SchedulePreview {
  const schedule = normalizeSchedule(scheduleInput)
  let job: Cron
  try {
    job = new Cron(schedule.cronExpression, {
      timezone: schedule.timezone,
      paused: true
    })
  } catch (error) {
    throw new Error(
      `Invalid cron expression: ${error instanceof Error ? error.message : String(error)}`
    )
  }

  const nextRuns: string[] = []
  let cursor = from
  for (let i = 0; i < count; i += 1) {
    const next = job.nextRun(cursor)
    if (!next) {
      break
    }
    nextRuns.push(next.toISOString())
    cursor = new Date(next.getTime() + 1000)
  }

  return {
    cronExpression: schedule.cronExpression,
    human: describeSchedule(schedule),
    timezone: schedule.timezone,
    nextRuns
  }
}

export function getNextRunAt(
  scheduleInput: TaskSchedule,
  from: Date = new Date()
): string | null {
  const preview = previewSchedule(scheduleInput, 1, from)
  return preview.nextRuns[0] ?? null
}
