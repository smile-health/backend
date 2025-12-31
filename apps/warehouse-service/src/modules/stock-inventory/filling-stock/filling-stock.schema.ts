import { z } from "zod"
import {
  StockInventoryBaseQueryParamsSchema,
  StockInventoryListDatasetSchema,
  StockInventoryEntityMaterialDatasetSchema,
} from "../stock-inventory.schema.js"
import { PeriodSchema } from "@/common/schemas/period.schema.js"

/**
 * Filling-stock specific query parameter validation schema
 * Extends the base schema with transaction_type defaulting to 'normal'
 */
export const FillingStockQueryParamsSchema = z.intersection(
  StockInventoryBaseQueryParamsSchema,
  z.object({
    transaction_type: z.enum(["normal"]).optional().default("normal"),
    information_type: z.enum(["count", "days"]).optional().default("days"),
  })
)

/**
 * Dataset schema for review endpoint (chart data)
 * Filling-stock specific for overview charts
 */
export const FillingStockReviewDatasetSchema = z.object({
  label: z.string(),
  color: z.string(),
  data: z.array(z.number().or(z.string())),
})

/**
 * Response schema for review endpoint
 * Filling-stock specific for overview/review data
 */
export const FillingStockReviewResponseSchema = z.object({
  last_updated: z.string(),
  data: z.object({
    categories: z.array(PeriodSchema),
    dataset: z.array(FillingStockReviewDatasetSchema),
  }),
})

/**
 * Dataset schema for material/entity/location endpoints
 * Uses 'period' field with filling stock value metrics
 */
export const FillingStockListDatasetSchema =
  StockInventoryListDatasetSchema.extend({
    period: z.array(
      z.object({
        label: z.string(),
        value: z.number().or(z.string()),
      })
    ),
  })

/**
 * Entity-Material specific dataset schema
 * Uses 'period' field with filling stock value metrics
 */
export const FillingStockEntityMaterialDatasetSchema =
  StockInventoryEntityMaterialDatasetSchema.extend({
    period: z.array(
      z.object({
        label: z.string(),
        value: z.number().or(z.string()),
      })
    ),
  })

/**
 * Response schema for paginated endpoints (material/entity/location)
 * Filling-stock specific with 'overview' field
 */
export const FillingStockListResponseSchema = z.object({
  last_updated: z.string(),
  data: z.object({
    categories: z.array(PeriodSchema),
    dataset: z.array(FillingStockListDatasetSchema),
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
 * Filling-stock specific with 'overview' field
 */
export const FillingStockEntityMaterialResponseSchema = z.object({
  last_updated: z.string(),
  data: z.object({
    categories: z.array(
      z.object({
        id: z.number(),
        label: z.string(),
      })
    ),
    dataset: z.array(FillingStockEntityMaterialDatasetSchema),
    type: z.array(z.object({ key: z.string(), label: z.string() })),
  }),
  page: z.number(),
  item_per_page: z.number(),
  total_item: z.number(),
  total_page: z.number(),
  list_pagination: z.array(z.number()),
})

// Type exports - filling-stock specific
export type FillingStockQueryParams = z.infer<
  typeof FillingStockQueryParamsSchema
>
export type FillingStockReviewDataset = z.infer<
  typeof FillingStockReviewDatasetSchema
>
export type FillingStockListDataset = z.infer<
  typeof FillingStockListDatasetSchema
>
export type FillingStockEntityMaterialDataset = z.infer<
  typeof FillingStockEntityMaterialDatasetSchema
>
export type FillingStockReviewResponse = z.infer<
  typeof FillingStockReviewResponseSchema
>
export type FillingStockListResponse = z.infer<
  typeof FillingStockListResponseSchema
>
export type FillingStockEntityMaterialResponse = z.infer<
  typeof FillingStockEntityMaterialResponseSchema
>
