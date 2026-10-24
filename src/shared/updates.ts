import { z } from 'zod'

export const UpdateStatusSchema = z.object({
  state: z.enum([
    'idle',
    'checking',
    'available',
    'not-available',
    'downloading',
    'downloaded',
    'error'
  ]),
  message: z.string().nullable(),
  version: z.string().nullable(),
  progressPercent: z.number().min(0).max(100).nullable()
})

export type UpdateStatus = z.infer<typeof UpdateStatusSchema>
