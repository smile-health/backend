import { QueryParamsSchema } from "@/common/schemas/query-param.schema.js"
import { z } from "zod"

export const SmileVsAsikQueryParamsSchema = z.intersection(
  QueryParamsSchema,
  z.object({
    region: z.string().pipe(z.coerce.number().int()).optional(),
    target_year: z.string().optional(),
  })
)

export type SmileVsAsikQueryParams = z.infer<
  typeof SmileVsAsikQueryParamsSchema
>

export const SmileDataSchema = z.object({
  location_id: z.number().nullable(),
  location_name: z.string().nullable(),
  consumption_unit_per_distribution_unit: z.number().nullable(),
  vial: z.number().nullable(),
  smile_qty: z.number().nullable(),
})

export type SmileDataDTO = z.infer<typeof SmileDataSchema>

export const AsikDataSchema = z.object({
  location_id: z.number().nullable(),
  pcare_qty: z.number().nullable(),
  injection_date: z.string().nullable(),
})

export type AsikDataDTO = z.infer<typeof AsikDataSchema>

export const LastUpdatedSchema = z.object({
  last_update: z.string(),
})

export type LastUpdatedDTO = z.infer<typeof LastUpdatedSchema>

export const ReviewDataItemSchema = z.object({
  id: z.number(),
  label: z.string(),
  value: z.number(),
  color: z.string(),
  tooltip: z.string(),
})

export const ReviewResponseSchema = z.object({
  last_updated: z.string(),
  data: z.array(ReviewDataItemSchema),
})

export type ReviewResponse = z.infer<typeof ReviewResponseSchema>

export const TableDataItemSchema = z.object({
  id: z.number(),
  label: z.string(),
  total_consumed: z.number(),
  total_pcare: z.number(),
  percentage: z.string(),
  vial: z.number(),
  consumption_unit_per_distribution_unit: z.number(),
  usage_index: z.union([z.number(), z.string()]),
  target_qty: z.string(),
  scope: z.string(),
})

export const TableResponseSchema = z.object({
  last_updated: z.string(),
  data: z.array(TableDataItemSchema),
  page: z.number(),
  item_per_page: z.number(),
  total_item: z.number(),
  total_page: z.number(),
  list_pagination: z.array(z.number()),
})

export type TableResponse = z.infer<typeof TableResponseSchema>
