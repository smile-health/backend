import { PeriodSchema } from "@/common/schemas/period.schema.js"
import { QueryParamsSchema } from "@/common/schemas/query-param.schema.js"
import { z } from "zod"

/**
 * Query parameter validation schema using intersection with common QueryParamsSchema
 * Aligned with OrderDifferenceQueryParamsSchema pattern
 */
export const ConsumptionSupplyQueryParamsSchema = z.intersection(
  QueryParamsSchema,
  z.object({
    period: z.enum(["day", "week", "month"]).optional().default("month"),
    information_type: z.enum(["consumption", "supply"]).optional(),
  })
)

// Data Transfer Object schemas - aligned with order-difference pattern
export const ConsumptionSupplyDataSchema = z.object({
  material_id: z.number().optional(),
  entity_id: z.number().optional(),
  location_id: z.number().optional(),
  consumption: z.number(),
  supply: z.number(),
  day: z.string(),
  week: z.number(),
  month: z.string(),
  year: z.string(),
  created_at: z.string(),
})

export const ConsumptionSupplyLastUpdatedSchema = z.object({
  last_updated: z.string(),
})

// Dataset schemas
export const ConsumptionSupplyReviewDatasetSchema = z.object({
  label: z.string(),
  color: z.string(),
  data: z.array(z.number()),
})

export const ConsumptionSupplyDatasetSchema = z.object({
  id: z.number(),
  name: z.string(),
  province_name: z.string().nullable().optional(),
  regency_name: z.string().nullable().optional(),
  period: z.array(
    z.object({
      consumption: z.number(),
      supply: z.number(),
    })
  ),
})

// Response schemas using the component schemas
export const ConsumptionSupplyReviewResponseSchema = z.object({
  last_updated: z.string(),
  data: z.object({
    categories: z.array(PeriodSchema),
    dataset: z.array(ConsumptionSupplyReviewDatasetSchema),
  }),
})

// Unified Zod schema for paginated responses (material, entity, location)
export const ConsumptionSupplyPaginatedResponseSchema = z.object({
  last_updated: z.string(),
  data: z.object({
    categories: z.array(PeriodSchema),
    dataset: z.array(ConsumptionSupplyDatasetSchema),
    type: z.array(z.object({ key: z.string(), label: z.string() })),
  }),
  page: z.number(),
  item_per_page: z.number(),
  total_item: z.number(),
  total_page: z.number(),
  list_pagination: z.array(z.number()),
})

// Legacy schema aliases for backward compatibility
export const ConsumptionSupplyMaterialResponseSchema =
  ConsumptionSupplyPaginatedResponseSchema
export const ConsumptionSupplyEntityResponseSchema =
  ConsumptionSupplyPaginatedResponseSchema
export const ConsumptionSupplyLocationResponseSchema =
  ConsumptionSupplyPaginatedResponseSchema

// Inferred TypeScript types from Zod schemas
export type ConsumptionSupplyQueryParams = z.infer<
  typeof ConsumptionSupplyQueryParamsSchema
>
export type ConsumptionSupplyDataDTO = z.infer<
  typeof ConsumptionSupplyDataSchema
>
export type ConsumptionSupplyLastUpdatedDTO = z.infer<
  typeof ConsumptionSupplyLastUpdatedSchema
>
export type ConsumptionSupplyReviewDatasetDTO = z.infer<
  typeof ConsumptionSupplyReviewDatasetSchema
>
export type ConsumptionSupplyDatasetDTO = z.infer<
  typeof ConsumptionSupplyDatasetSchema
>
export type ConsumptionSupplyReviewResponse = z.infer<
  typeof ConsumptionSupplyReviewResponseSchema
>
export type ConsumptionSupplyPaginatedResponse = z.infer<
  typeof ConsumptionSupplyPaginatedResponseSchema
>

// Legacy type aliases for backward compatibility
export type ConsumptionSupplyMaterialResponse =
  ConsumptionSupplyPaginatedResponse
export type ConsumptionSupplyEntityResponse = ConsumptionSupplyPaginatedResponse
export type ConsumptionSupplyLocationResponse =
  ConsumptionSupplyPaginatedResponse

// Simple DTOs for repository layer
export type ConsumptionSupplyLocationDTO = {
  id: number
  name: string
  province_name?: string | null
  regency_name?: string | null
}

export type ConsumptionSupplyEntityDTO = {
  id: number
  name: string
  province_name?: string | null
  regency_name?: string | null
}

export type ConsumptionSupplyMaterialDTO = {
  id: number
  name: string
}

export type ConsumptionSupplyExportFilterDTO = {
  period: string
  dateRange: string
  province?: string
  regency?: string
  entity?: string
  material?: string
  activity?: string
}
