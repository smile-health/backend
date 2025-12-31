import { z } from "zod"
import {
  StockInventoryBaseQueryParamsSchema,
  StockInventoryListDatasetSchema,
  StockInventoryEntityMaterialDatasetSchema,
} from "../stock-inventory.schema.js"
import { PeriodSchema } from "@/common/schemas/period.schema.js"

/**
 * Abnormal-stock specific query parameter validation schema
 * Extends the base schema with transaction_type and information_type validation
 */
export const AbnormalStockQueryParamsSchema = z.intersection(
  StockInventoryBaseQueryParamsSchema,
  z.object({
    transaction_type: z.enum(["zero", "min", "max"]).optional(),
    information_type: z.enum(["count", "days"]).optional().default("count"),
  })
)

/**
 * Dataset schema for review endpoint (chart data)
 * Abnormal-stock specific for overview charts
 */
export const AbnormalStockReviewDatasetSchema = z.object({
  label: z.string(),
  color: z.string(),
  data: z.array(z.number().or(z.string())),
})

/**
 * Response schema for review endpoint
 * Abnormal-stock specific for overview/review data
 */
export const AbnormalStockReviewResponseSchema = z.object({
  last_updated: z.string(),
  data: z.object({
    categories: z.array(PeriodSchema),
    dataset: z.array(AbnormalStockReviewDatasetSchema),
  }),
})

/**
 * Dataset schema for material/entity/location endpoints
 * Uses 'period' field with abnormal stock value metrics
 */
export const AbnormalStockListDatasetSchema =
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
 * Uses 'period' field with abnormal stock value metrics
 */
export const AbnormalStockEntityMaterialDatasetSchema =
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
 * Abnormal-stock specific with 'overview' field
 */
export const AbnormalStockListResponseSchema = z.object({
  last_updated: z.string(),
  data: z.object({
    categories: z.array(PeriodSchema),
    dataset: z.array(AbnormalStockListDatasetSchema),
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
 * Abnormal-stock specific with 'overview' field
 */
export const AbnormalStockEntityMaterialResponseSchema = z.object({
  last_updated: z.string(),
  data: z.object({
    categories: z.array(
      z.object({
        id: z.number(),
        label: z.string(),
      })
    ),
    dataset: z.array(AbnormalStockEntityMaterialDatasetSchema),
    type: z.array(z.object({ key: z.string(), label: z.string() })),
  }),
  page: z.number(),
  item_per_page: z.number(),
  total_item: z.number(),
  total_page: z.number(),
  list_pagination: z.array(z.number()),
})

// Type exports - abnormal-stock specific
export type AbnormalStockQueryParams = z.infer<
  typeof AbnormalStockQueryParamsSchema
>
export type AbnormalStockReviewDataset = z.infer<
  typeof AbnormalStockReviewDatasetSchema
>
export type AbnormalStockListDataset = z.infer<
  typeof AbnormalStockListDatasetSchema
>
export type AbnormalStockEntityMaterialDataset = z.infer<
  typeof AbnormalStockEntityMaterialDatasetSchema
>
export type AbnormalStockReviewResponse = z.infer<
  typeof AbnormalStockReviewResponseSchema
>
export type AbnormalStockListResponse = z.infer<
  typeof AbnormalStockListResponseSchema
>
export type AbnormalStockEntityMaterialResponse = z.infer<
  typeof AbnormalStockEntityMaterialResponseSchema
>
