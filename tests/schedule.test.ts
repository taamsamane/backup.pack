import { describe, expect, it } from 'vitest'
import {
  buildCronExpression,
  describeSchedule,
  normalizeSchedule,
  previewSchedule
} from '../src/shared/schedule'
import { TaskCreateSchema, TaskScheduleSchema } from '../src/shared/tasks'

describe('buildCronExpression', () => {
  it('builds every-minute schedules', () => {
    expect(
      buildCronExpression({
        timezone: 'UTC',
        mode: 'every',
        everyValue: 15,
        everyUnit: 'minute'
      })
    ).toBe('*/15 * * * *')
  })

  it('builds every-hour schedules', () => {
    expect(
      buildCronExpression({
        timezone: 'UTC',
        mode: 'every',
        everyValue: 2,
        everyUnit: 'hour'
      })
    ).toBe('0 */2 * * *')
  })

  it('builds daily schedules', () => {
    expect(
      buildCronExpression({
        timezone: 'UTC',
        mode: 'daily',
        hour: 3,
        minute: 30
      })
    ).toBe('30 3 * * *')
  })

  it('builds weekly schedules with sorted days', () => {
    expect(
      buildCronExpression({
        timezone: 'UTC',
        mode: 'weekly',
        hour: 9,
        minute: 0,
        daysOfWeek: [5, 1, 3]
      })
    ).toBe('0 9 * * 1,3,5')
  })

  it('builds monthly schedules', () => {
    expect(
      buildCronExpression({
        timezone: 'UTC',
        mode: 'monthly',
        hour: 1,
        minute: 15,
        dayOfMonth: 28
      })
    ).toBe('15 1 28 * *')
  })
})

describe('normalizeSchedule / previewSchedule', () => {
  it('fills cronExpression for wizard modes', () => {
    const schedule = normalizeSchedule({
      timezone: 'UTC',
      mode: 'daily',
      cronExpression: '',
      hour: 2,
      minute: 0
    })
    expect(schedule.cronExpression).toBe('0 2 * * *')
    expect(describeSchedule(schedule)).toContain('Daily')
  })

  it('previews next runs with a fixed clock', () => {
    const from = new Date('2026-10-22T10:00:00.000Z')
    const preview = previewSchedule(
      {
        timezone: 'UTC',
        mode: 'every',
        cronExpression: '',
        everyValue: 30,
        everyUnit: 'minute'
      },
      3,
      from
    )
    expect(preview.cronExpression).toBe('*/30 * * * *')
    expect(preview.nextRuns).toHaveLength(3)
    expect(preview.nextRuns[0]).toBe('2026-10-22T10:30:00.000Z')
    expect(preview.nextRuns[1]).toBe('2026-10-22T11:00:00.000Z')
  })

  it('rejects invalid cron expressions', () => {
    expect(() =>
      previewSchedule({
        timezone: 'UTC',
        mode: 'cron',
        cronExpression: 'not a cron'
      })
    ).toThrow(/Invalid cron/i)
  })
})

describe('TaskCreateSchema', () => {
  it('requires archive password when encryptArchive is true', () => {
    expect(() =>
      TaskCreateSchema.parse({
        name: 'nightly',
        profileId: '550e8400-e29b-41d4-a716-446655440000',
        targetFolder: '/backups',
        schedule: {
          timezone: 'UTC',
          mode: 'daily',
          hour: 2,
          minute: 0
        },
        settings: {
          fullBackup: true,
          compress: true,
          encryptArchive: true,
          excludePatterns: []
        }
      })
    ).toThrow()
  })

  it('accepts a valid daily task', () => {
    const parsed = TaskCreateSchema.parse({
      name: 'nightly-db',
      profileId: '550e8400-e29b-41d4-a716-446655440000',
      targetFolder: '/backups',
      schedule: {
        timezone: 'Asia/Tehran',
        mode: 'daily',
        hour: 2,
        minute: 30
      },
      settings: {
        fullBackup: true,
        compress: true,
        encryptArchive: false,
        excludePatterns: ['*.tmp']
      }
    })
    expect(parsed.enabled).toBe(true)
    expect(TaskScheduleSchema.parse(parsed.schedule).mode).toBe('daily')
  })
})
