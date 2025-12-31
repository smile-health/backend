import { z } from 'zod'

// Schema for pushing history data (v2 pattern - array of history items)
export const PushLoggerHistoryDTOSchema = z.array(z.object({
  device_id: z.string().min(1, 'Device ID is required'),
  lat: z.number().optional(),
  lon: z.number().optional(),
  curr_temp: z.number({ required_error: 'Current temperature is required' }),
  actual_date: z.string().optional(),
  status_device: z.boolean().optional(),
  battery: z.number().int().optional(),
  signal: z.number().int().optional(),
  power: z.boolean().optional(),
  humidity: z.number().optional(),
}))

// Schema for single push (v1 pattern)
export const PushSingleLoggerHistoryDTOSchema = z.object({
  device_id: z.string().min(1, 'Device ID is required'),
  lat: z.number().optional(),
  lng: z.number().optional(),
  curr_temp: z.number({ required_error: 'Current temperature is required' }),
  actual_date: z.string().optional(),
  status_device: z.boolean().optional(),
  battery: z.number().int().optional(),
  signal: z.number().int().optional(),
  power: z.boolean().optional(),
})

// Response schema for push operations
export const PushLoggerHistoryResponseSchema = z.object({
  data: z.array(z.object({
    device_id: z.string(),
    lat: z.number().optional(),
    lon: z.number().optional(),
    curr_temp: z.number(),
    actual_date: z.string().optional(),
    status_device: z.boolean().optional(),
    battery: z.number().int().optional(),
    signal: z.number().int().optional(),
    power: z.boolean().optional(),
    humidity: z.number().optional(),
    message: z.string(),
    result: z.string(),
  })),
  message: z.string(),
})

// TypeScript types
export type PushLoggerHistoryDTO = z.infer<typeof PushLoggerHistoryDTOSchema>
export type PushSingleLoggerHistoryDTO = z.infer<typeof PushSingleLoggerHistoryDTOSchema>
export type PushLoggerHistoryResponse = z.infer<typeof PushLoggerHistoryResponseSchema>