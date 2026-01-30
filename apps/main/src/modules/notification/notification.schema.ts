import { PaginationQueriesSchema } from "@smile-health/lib/types/paginate.js"
import { z } from "zod"

/**
 * Stock back to normal
 */
export const StockBackToNormalRequest = z.object({
  entity_id: z.number().int(),
  material_id: z.number().int(),
  activity_id: z.number().int(),
  old_stock: z.number().int(),
})

export type StockBackToNormalRequestType = z.infer<
  typeof StockBackToNormalRequest
>

export interface StockBackToNormalData {
  entity_id: number
  material_id: number
  activity_id: number
  material_name: string
  material_consumption_unit: string
  material_type_id: number
  customer_entity_name: string
  current_stock: number
  min_stock: number
  regency_name: string
  is_fasyankes: boolean
}

export interface StockBackToNormalNotificationPayload {
  url: string
  method: string
  headers: {
    "x-program-id": number
    "Accept-Language": string
    timezone: string
  }
  data: {
    entity_id: number
    material_id: number
    activity_id: number
    old_stock: number
  }
}

/**
 * Stop notification reason
 */
export const StopNotificationReasonPaginatedRequestSchema =
  PaginationQueriesSchema.omit({ keyword: true }).extend({
    protocol_id: z
      .string()
      .optional()
      .transform((val) => (val ? Number(val) : undefined))
      .refine((val) => val === undefined || (!Number.isNaN(val) && val > 0), {
        message: "INVALID_PROTOCOL_ID",
      }),
  })

export type StopNotificationReasonPaginatedRequestType = z.infer<
  typeof StopNotificationReasonPaginatedRequestSchema
>

export type StopNotificationReasonSelectedColumns = {
  id: number
  title: string
  protocol_id: number
}

/**
 * Trigger patient reminder notification
 */
export const TriggerPatientReminderNotificationSchema = z.object({
  entity_ids: z
    .string()
    .refine(
      (val) =>
        val
          .split(",")
          .filter((item) => item !== "")
          .every((num) => !isNaN(Number(num))),
      {
        message: "INVALID_ENTITY_IDS_PARAM",
      }
    )
    .transform((val) =>
      val
        .split(",")
        .filter((item) => item !== "")
        .map((item) => Number(item))
    )
    .optional(),
})

export type TriggerPatientReminderNotificationQueries = z.infer<
  typeof TriggerPatientReminderNotificationSchema
>

/**
 * Stop notification
 */
export const StopNotificationRequest = z.object({
  notification_id: z.number().int(),
  consumption_id: z.number().int(),
  reason_id: z.number().int(),
})

export type StopNotificationRequestType = z.infer<
  typeof StopNotificationRequest
>
