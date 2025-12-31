import { z } from "@hono/zod-openapi"

export const IotHistoryRequestSchema = z.array(
  z.object({
    device_id: z.string(),
    lat: z.string(),
    lon: z.string(),
    curr_temp: z.string(),
    humidity: z.string(),
    actual_date: z.string(),
    status_device: z.boolean(),
    battery: z.number().default(0),
    signal: z.number().default(0),
    power: z.boolean(),
  })
)

export const IotHistoryResponseItemSchema = z.object({
  device_id: z.string(),
  lat: z.string(),
  lon: z.string(),
  curr_temp: z.string(),
  message: z.string(),
  status: z.string(),
})

export const IotHistoryResponseSchema = z.object({
  data: z.array(IotHistoryResponseItemSchema),
  message: z.string(),
})