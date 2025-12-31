import { PeriodSchema } from "@/common/schemas/period.schema.js"
import { QueryParamsSchema } from "@/common/schemas/query-param.schema.js"
import { z } from "zod"

/**
 * Query parameter validation schemas using intersection with common QueryParamsSchema
 */
export const OrderDifferenceQueryParamsSchema = z.intersection(
  QueryParamsSchema,
  z.object({
    period: z.enum(["day", "week", "month"]).optional().default("month"),
    information_type: z.enum(["1", "2", "3"]).optional(),
    reason_id: z
      .string()
      .transform((val) => (val ? parseInt(val) : undefined))
      .optional(),
  })
)

// Data Transfer Object schemas
export const OrderDifferenceDataSchema = z.object({
  master_material_id: z.number(),
  entities_id: z.number(),
  sent: z.number(),
  received: z.number(),
  ordered: z.number(),
  recommended: z.number(),
  day: z.string(),
  week: z.number(),
  month: z.string(),
  year: z.string(),
  created_at: z.string(),
  location_id: z.number(),
})

export const OrderDifferenceLastUpdatedSchema = z.object({
  last_updated: z.string(),
})

// Dataset schemas
export const OrderDifferenceReviewDatasetSchema = z.object({
  label: z.string(),
  color: z.string(),
  data: z.array(z.number()),
})

export const OrderDifferenceDatasetSchema = z.object({
  id: z.number(),
  name: z.string(),
  province_name: z.string().nullable().optional(),
  regency_name: z.string().nullable().optional(),
  period: z.array(
    z.object({
      recommended: z.number(),
      ordered: z.number(),
      sent: z.number(),
      received: z.number(),
    })
  ),
})

// Information type enum for series selection
export enum InformationType {
  PESANAN_BARU = "1",
  PENGIRIMAN = "2",
  PENERIMAAN = "3",
  ALL = "all",
}

// Export filter data schema
export const OrderDifferenceExportFilterSchema = z.object({
  period: z.string(),
  dateRange: z.string(),
  province: z.string().optional(),
  regency: z.string().optional(),
  entity: z.string().optional(),
  material: z.string().optional(),
  activity: z.string().optional(),
  informationType: z.string().optional(),
  reason: z.string().optional(),
})

// Response schemas using the component schemas
export const OrderDifferenceReviewResponseSchema = z.object({
  last_updated: z.string(),
  data: z.object({
    categories: z.array(PeriodSchema),
    dataset: z.array(OrderDifferenceReviewDatasetSchema),
  }),
})

// Unified Zod schema for paginated responses (material, entity, location)
export const OrderDifferencePaginatedResponseSchema = z.object({
  last_updated: z.string(),
  data: z.object({
    categories: z.array(PeriodSchema),
    dataset: z.array(OrderDifferenceDatasetSchema),
    type: z.array(z.object({ key: z.string(), label: z.string() })),
  }),
  page: z.number(),
  item_per_page: z.number(),
  total_item: z.number(),
  total_page: z.number(),
  list_pagination: z.array(z.number()),
})

// Legacy schema aliases for backward compatibility
export const OrderDifferenceEntityLocationResponseSchema =
  OrderDifferencePaginatedResponseSchema

// Inferred TypeScript types from Zod schemas
export type OrderDifferenceQueryParams = z.infer<
  typeof OrderDifferenceQueryParamsSchema
>
export type OrderDifferenceDataDTO = z.infer<typeof OrderDifferenceDataSchema>
export type OrderDifferenceLastUpdatedDTO = z.infer<
  typeof OrderDifferenceLastUpdatedSchema
>
export type OrderDifferenceReviewDatasetDTO = z.infer<
  typeof OrderDifferenceReviewDatasetSchema
>
export type OrderDifferenceDatasetDTO = z.infer<
  typeof OrderDifferenceDatasetSchema
>
export type OrderDifferenceExportFilterDTO = z.infer<
  typeof OrderDifferenceExportFilterSchema
>
export type OrderDifferenceReviewResponse = z.infer<
  typeof OrderDifferenceReviewResponseSchema
>
export type OrderDifferencePaginatedResponse = z.infer<
  typeof OrderDifferencePaginatedResponseSchema
>
