import { randomUUID } from 'crypto'
import { Cron } from 'croner'
import { and, desc, eq, inArray } from 'drizzle-orm'
import { shouldCatchUpMissedRun } from '../../shared/backup/catchUp'
import { normalizeSchedule } from '../../shared/schedule'
import type { TaskSchedule } from '../../shared/tasks'
import { notifyRunQueued } from '../backup/worker'
import { getOrm } from '../db/client'
import { taskRuns, tasks } from '../db/schema'
import { getLogger } from '../logging/logger'
import { listEnabledTaskRows } from './repository'

type JobEntry = {
  taskId: string
  job: Cron
}

const jobs = new Map<string, JobEntry>()
let started = false

export type EnqueueReason = 'schedule' | 'manual' | 'catchup'

/**
 * Enqueue a run. The backup worker claims `pending` rows.
 * Overlapping fires for the same task are skipped while a run is already pending/running.
 */
export function enqueueScheduledRun(
  taskId: string,
  reason: EnqueueReason = 'schedule',
  options: { dryRun?: boolean } = {}
): string {
  const dryRun = options.dryRun === true
  const orm = getOrm()
  const row = orm.select().from(tasks).where(eq(tasks.id, taskId)).get()
  if (!row) {
    throw new Error('Task not found')
  }
  if (!row.enabled && reason === 'schedule') {
    throw new Error('Task is disabled')
  }

  const active = orm
    .select()
    .from(taskRuns)
    .where(and(eq(taskRuns.taskId, taskId), inArray(taskRuns.status, ['pending', 'running'])))
    .all()

  if (active.length > 0) {
    getLogger('scheduler').info(
      { taskId, activeRunId: active[0]?.id },
      'Skipping enqueue — run already active'
    )
    return active[0]!.id
  }

  const id = randomUUID()
  const now = new Date().toISOString()
  orm
    .insert(taskRuns)
    .values({
      id,
      taskId,
      status: 'pending',
      dryRun,
      createdAt: now,
      errorMessage: null
    })
    .run()

  getLogger('scheduler').info({ taskId, runId: id, reason, dryRun }, 'Enqueued task run')
  notifyRunQueued()
  return id
}

function stopJob(taskId: string): void {
  const entry = jobs.get(taskId)
  if (!entry) {
    return
  }
  entry.job.stop()
  jobs.delete(taskId)
}

function maybeCatchUp(taskId: string, job: Cron, catchUpMissed: boolean): void {
  if (!catchUpMissed) {
    return
  }
  const previousFireAt = job.previousRun() ?? null
  const last = getOrm()
    .select()
    .from(taskRuns)
    .where(eq(taskRuns.taskId, taskId))
    .orderBy(desc(taskRuns.createdAt))
    .limit(1)
    .get()
  const lastRunCreatedAt = last?.createdAt ? new Date(last.createdAt) : null
  if (
    !shouldCatchUpMissedRun({
      catchUpMissed,
      previousFireAt,
      lastRunCreatedAt
    })
  ) {
    return
  }
  try {
    const runId = enqueueScheduledRun(taskId, 'catchup')
    getLogger('scheduler').info(
      {
        taskId,
        runId,
        previousFireAt: previousFireAt?.toISOString() ?? null
      },
      'Catch-up run enqueued'
    )
  } catch (error) {
    getLogger('scheduler').error(
      { taskId, err: error instanceof Error ? error.message : String(error) },
      'Failed to enqueue catch-up run'
    )
  }
}

function startJob(taskId: string, schedule: TaskSchedule, catchUpMissed: boolean): void {
  stopJob(taskId)
  const normalized = normalizeSchedule(schedule)

  const job = new Cron(
    normalized.cronExpression,
    {
      timezone: normalized.timezone,
      protect: true,
      name: `task:${taskId}`
    },
    () => {
      try {
        enqueueScheduledRun(taskId, 'schedule')
      } catch (error) {
        getLogger('scheduler').error(
          { taskId, err: error instanceof Error ? error.message : String(error) },
          'Failed to enqueue scheduled run'
        )
      }
    }
  )

  jobs.set(taskId, { taskId, job })
  getLogger('scheduler').info(
    {
      taskId,
      cron: normalized.cronExpression,
      timezone: normalized.timezone,
      next: job.nextRun()?.toISOString() ?? null,
      catchUpMissed
    },
    'Scheduled task'
  )
  maybeCatchUp(taskId, job, catchUpMissed)
}

export function rescheduleTask(taskId: string): void {
  const row = getOrm().select().from(tasks).where(eq(tasks.id, taskId)).get()
  if (!row || !row.enabled) {
    stopJob(taskId)
    return
  }
  const schedule = normalizeSchedule(JSON.parse(row.scheduleJson) as TaskSchedule)
  startJob(taskId, schedule, row.catchUpMissed)
}

export function unscheduleTask(taskId: string): void {
  stopJob(taskId)
}

export function startScheduler(): void {
  if (started) {
    return
  }
  started = true
  for (const row of listEnabledTaskRows()) {
    try {
      const schedule = normalizeSchedule(JSON.parse(row.scheduleJson) as TaskSchedule)
      startJob(row.id, schedule, row.catchUpMissed)
    } catch (error) {
      getLogger('scheduler').error(
        { taskId: row.id, err: error instanceof Error ? error.message : String(error) },
        'Failed to schedule task on startup'
      )
    }
  }
  getLogger('scheduler').info({ jobs: jobs.size }, 'Scheduler started')
}

export function stopScheduler(): void {
  for (const taskId of [...jobs.keys()]) {
    stopJob(taskId)
  }
  started = false
  getLogger('scheduler').info('Scheduler stopped')
}

export function listUpcomingRuns(limit = 20): Array<{
  taskId: string
  taskName: string
  nextRunAt: string
  enabled: boolean
  lastStatus: string | null
}> {
  const items: Array<{
    taskId: string
    taskName: string
    nextRunAt: string
    enabled: boolean
    lastStatus: string | null
  }> = []

  for (const row of getOrm().select().from(tasks).all()) {
    if (!row.enabled) {
      continue
    }
    const entry = jobs.get(row.id)
    let next: Date | null = null
    if (entry) {
      next = entry.job.nextRun()
    } else {
      try {
        const schedule = normalizeSchedule(JSON.parse(row.scheduleJson) as TaskSchedule)
        const preview = new Cron(schedule.cronExpression, {
          timezone: schedule.timezone,
          paused: true
        })
        next = preview.nextRun()
      } catch {
        next = null
      }
    }
    if (!next) {
      continue
    }

    const last = getOrm()
      .select()
      .from(taskRuns)
      .where(eq(taskRuns.taskId, row.id))
      .all()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]

    items.push({
      taskId: row.id,
      taskName: row.name,
      nextRunAt: next.toISOString(),
      enabled: row.enabled,
      lastStatus: last?.status ?? null
    })
  }

  return items.sort((a, b) => a.nextRunAt.localeCompare(b.nextRunAt)).slice(0, limit)
}
