import { randomUUID } from 'crypto'
import { and, desc, eq } from 'drizzle-orm'
import type { CycleSnapshot } from '../../shared/backup/types'
import { getOrm } from '../db/client'
import { cycles } from '../db/schema'

export function getActiveCycle(taskId: string): CycleSnapshot | null {
  const row = getOrm()
    .select()
    .from(cycles)
    .where(and(eq(cycles.taskId, taskId), eq(cycles.status, 'active')))
    .orderBy(desc(cycles.startedAt))
    .limit(1)
    .get()
  if (!row) {
    return null
  }
  return {
    id: row.id,
    folderName: row.folderName,
    startedAt: row.startedAt,
    status: row.status
  }
}

export function listCyclesForTask(taskId: string): Array<typeof cycles.$inferSelect> {
  return getOrm()
    .select()
    .from(cycles)
    .where(eq(cycles.taskId, taskId))
    .orderBy(desc(cycles.startedAt))
    .all()
}

export function createActiveCycle(input: {
  taskId: string
  folderName: string
  startedAt: string
}): typeof cycles.$inferSelect {
  const id = randomUUID()
  const createdAt = new Date().toISOString()
  getOrm()
    .insert(cycles)
    .values({
      id,
      taskId: input.taskId,
      folderName: input.folderName,
      startedAt: input.startedAt,
      endedAt: null,
      status: 'active',
      archivePath: null,
      createdAt
    })
    .run()
  const row = getOrm().select().from(cycles).where(eq(cycles.id, id)).get()
  if (!row) {
    throw new Error('Failed to create cycle')
  }
  return row
}

export function markCycleFinalizing(cycleId: string): void {
  getOrm()
    .update(cycles)
    .set({ status: 'finalizing' })
    .where(eq(cycles.id, cycleId))
    .run()
}

export function markCycleArchived(input: {
  cycleId: string
  endedAt: string
  archivePath: string | null
}): void {
  getOrm()
    .update(cycles)
    .set({
      status: 'archived',
      endedAt: input.endedAt,
      archivePath: input.archivePath
    })
    .where(eq(cycles.id, input.cycleId))
    .run()
}

export function deleteCycleRow(cycleId: string): void {
  getOrm().delete(cycles).where(eq(cycles.id, cycleId)).run()
}
