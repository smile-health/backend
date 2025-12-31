import { QueryParamsSchema } from "@/common/schemas/query-param.schema.js"
import { z } from "zod"

export const PeriodicMaterialStockQueryParamsSchema = QueryParamsSchema.and(
  z.object({
    period: z.enum(["monthly", "annual"]).default("monthly"),
  })
)

export type PeriodicMaterialStockQueryParams = z.infer<
  typeof PeriodicMaterialStockQueryParamsSchema
>

export const MaterialReportItemSchema = z.object({
  id: z.number(),
  name: z.string(),
  number: z.union([z.number(), z.string()]).optional(),
  opening_qty: z.number(),
  received_qty: z.number(),
  ordered_qty: z.number(),
  issues_qty: z.number(),
  discard_qty: z.number(),
  closing_qty: z.number(),
  vaccine_ip: z.string().optional(),
  scope_total: z.string().optional(),
})

export type MaterialReportItem = z.infer<typeof MaterialReportItemSchema>

export const PeriodicMaterialStockResponseSchema = z.object({
  period: z.enum(["monthly", "annual"]),
  province_name: z.string(),
  regency_name: z.string(),
  entity_name: z.string(),
  data: z.array(MaterialReportItemSchema),
  last_updated: z.string(),
})

export type PeriodicMaterialStockResponse = z.infer<
  typeof PeriodicMaterialStockResponseSchema
>

export const MaterialQtyDataSchema = z.object({
  entity_id: z.number(),
  date: z.string(),
  material_id: z.number(),
  opening_qty: z.number(),
  received_qty: z.number(),
  ordered_qty: z.number(),
  distribution_qty: z.number(),
  issues_qty: z.number(),
  discard_qty: z.number(),
  other_qty: z.number(),
  closing_qty: z.number(),
  vaccine_ip: z.string().nullable().optional(),
  scope_total: z.string().nullable().optional(),
})

export type MaterialQtyData = z.infer<typeof MaterialQtyDataSchema>
