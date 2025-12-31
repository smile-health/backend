import { z } from "zod"
import {
  StockInventoryBaseQueryParamsSchema,
  StockInventoryListDatasetSchema,
  StockInventoryEntityMaterialDatasetSchema,
} from "../stock-inventory.schema.js"
import { PeriodSchema } from "@/common/schemas/period.schema.js"

/**
 * Stock-availability specific query parameter validation schema
 * Extends the base schema with information_type validation
 */
export const StockAvailabilityQueryParamsSchema = z.intersection(
  StockInventoryBaseQueryParamsSchema,
  z.object({
    information_type: z.enum(["1", "2", "3", "4"]).optional().default("1"),
  })
)

/**
 * Dataset schema for review endpoint (chart data)
 * Stock-availability specific for overview charts
 */
export const StockAvailabilityReviewDatasetSchema = z.object({
  label: z.string(),
  color: z.string(),
  data: z.array(z.number().or(z.string())),
})

/**
 * Response schema for review endpoint
 * Stock-availability specific for overview/review data
 */
export const StockAvailabilityReviewResponseSchema = z.object({
  last_updated: z.string(),
  data: z.object({
    categories: z.array(PeriodSchema),
    dataset: z.array(StockAvailabilityReviewDatasetSchema),
  }),
})

/**
 * Dataset schema for material/entity/location endpoints
 * Uses 'period' field for backward compatibility with existing API
 */
export const StockAvailabilityListDatasetSchema =
  StockInventoryListDatasetSchema.extend({
    period: z.array(
      z.object({
        label: z.string(),
        availability: z.number().or(z.string()).optional(),
        "90-100": z.number().or(z.string()).optional(),
        "70-89": z.number().or(z.string()).optional(),
        "50-69": z.number().or(z.string()).optional(),
        "<50": z.number().or(z.string()).optional(),
      })
    ),
  })

/**
 * Entity-Material specific dataset schema
 * Uses 'period' field for backward compatibility
 */
export const StockAvailabilityEntityMaterialDatasetSchema =
  StockInventoryEntityMaterialDatasetSchema.extend({
    period: z.array(
      z.object({
        label: z.string(),
        availability: z.number().or(z.string()).optional(),
        "90-100": z.number().or(z.string()).optional(),
        "70-89": z.number().or(z.string()).optional(),
        "50-69": z.number().or(z.string()).optional(),
        "<50": z.number().or(z.string()).optional(),
      })
    ),
  })

/**
 * Response schema for paginated endpoints (material/entity/location)
 * Stock-availability specific with 'period' field
 */
export const StockAvailabilityListResponseSchema = z.object({
  last_updated: z.string(),
  data: z.object({
    categories: z.array(PeriodSchema),
    dataset: z.array(StockAvailabilityListDatasetSchema),
    type: z.array(z.object({ key: z.string(), label: z.string() })),
  }),
  page: z.number(),
  item_per_page: z.number(),
  total_item: z.number(),
  total_page: z.number(),
  list_pagination: z.array(z.number()),
})

/**
 * Response schema for entity-material endpoint
 * Stock-availability specific with 'period' field
 */
export const StockAvailabilityEntityMaterialResponseSchema = z.object({
  last_updated: z.string(),
  data: z.object({
    categories: z.array(
      z.object({
        id: z.number(),
        label: z.string(),
      })
    ),
    dataset: z.array(StockAvailabilityEntityMaterialDatasetSchema),
    type: z.array(z.object({ key: z.string(), label: z.string() })),
  }),
  page: z.number(),
  item_per_page: z.number(),
  total_item: z.number(),
  total_page: z.number(),
  list_pagination: z.array(z.number()),
})

// Type exports - stock-availability specific
export type StockAvailabilityQueryParams = z.infer<
  typeof StockAvailabilityQueryParamsSchema
>
export type StockAvailabilityReviewDataset = z.infer<
  typeof StockAvailabilityReviewDatasetSchema
>
export type StockAvailabilityListDataset = z.infer<
  typeof StockAvailabilityListDatasetSchema
>
export type StockAvailabilityEntityMaterialDataset = z.infer<
  typeof StockAvailabilityEntityMaterialDatasetSchema
>
export type StockAvailabilityReviewResponse = z.infer<
  typeof StockAvailabilityReviewResponseSchema
>
export type StockAvailabilityListResponse = z.infer<
  typeof StockAvailabilityListResponseSchema
>
export type StockAvailabilityEntityMaterialResponse = z.infer<
  typeof StockAvailabilityEntityMaterialResponseSchema
>
