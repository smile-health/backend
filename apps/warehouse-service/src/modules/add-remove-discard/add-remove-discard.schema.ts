import { z } from "zod"
import { PeriodSchema } from "@/common/schemas/period.schema.js"
import { QueryParamsSchema } from "@/common/schemas/query-param.schema.js"
import { IdsSchema } from "@smile-health/lib/types/param.js"

/**
 * Base query parameter validation schema for add-remove-discard modules
 * Shared between add-remove-stock and stock-discard modules
 */
export const AddRemoveDiscardBaseQueryParamsSchema = z.intersection(
  QueryParamsSchema,
  z.object({
    period: z.enum(["day", "week", "month"]).optional().default("month"),
    reason_ids: IdsSchema.nullish(),
    transaction_type: IdsSchema.nullish(),
  })
)

/**
 * Add-remove-stock specific query parameters (allows transaction_type selection)
 */
export const AddRemoveStockQueryParamsSchema =
  AddRemoveDiscardBaseQueryParamsSchema

/**
 * Stock-discard specific query parameters (transaction_type is always "4")
 */
export const StockDiscardQueryParamsSchema =
  AddRemoveDiscardBaseQueryParamsSchema

// Raw data from database query - shared structure
export const AddRemoveDiscardDataSchema = z.object({
  // Grouping keys (optional based on endpoint)
  master_material_id: z.number().optional(),
  entities_id: z.number().optional(),
  location_id: z.number().optional(),

  // Transaction data
  transaction_reason_id: z.number(),
  change_qty: z.number(),

  // Period fields
  day: z.string(),
  week: z.number(),
  month: z.string(),
  year: z.string(),
})

// Review endpoint response (chart format) - shared structure
export const AddRemoveDiscardReviewDatasetSchema = z.object({
  label: z.string(),
  color: z.string(),
  data: z.array(z.number()),
})

export const AddRemoveDiscardReviewResponseSchema = z.object({
  last_updated: z.string(),
  data: z.object({
    categories: z.array(PeriodSchema),
    dataset: z.array(AddRemoveDiscardReviewDatasetSchema),
  }),
})

// Material/Entity/Location endpoint response (paginated format) - shared structure
export const AddRemoveDiscardDatasetSchema = z.object({
  id: z.number(),
  name: z.string(),
  period: z.array(z.record(z.string(), z.number())), // Dynamic keys based on transaction reasons
  // Optional fields for entity/location exports
  province_name: z.string().optional(),
  regency_name: z.string().optional(),
})

export const AddRemoveDiscardPaginatedResponseSchema = z.object({
  last_updated: z.string(),
  data: z.object({
    categories: z.array(PeriodSchema),
    dataset: z.array(AddRemoveDiscardDatasetSchema),
    type: z.array(z.object({ label: z.string(), key: z.string() })), // Series labels
  }),
  page: z.number(),
  item_per_page: z.number(),
  total_item: z.number(),
  total_page: z.number(),
  list_pagination: z.array(z.number()),
})

// Export filter data schema - shared structure
export const AddRemoveDiscardExportFilterSchema = z.object({
  period: z.string(),
  dateRange: z.string(),
  province: z.string().optional(),
  regency: z.string().optional(),
  activity: z.string().optional(),
  material: z.string().optional(),
  materialType: z.string().optional(),
  entity: z.string().optional(),
  entityTag: z.string().optional(),
  transactionType: z.string().optional(),
  reason: z.string().optional(),
})

// Transaction Reason Schema - shared
export const TransactionReasonSchema = z.object({
  id: z.number(),
  title: z.string(),
})

// Last Updated Schema - shared
export const LastUpdatedSchema = z.object({
  last_updated: z.string().nullable(),
})

// Type exports - shared types
export type AddRemoveDiscardBaseQueryParams = z.infer<
  typeof AddRemoveDiscardBaseQueryParamsSchema
>

export type AddRemoveStockQueryParams = z.infer<
  typeof AddRemoveStockQueryParamsSchema
>

export type StockDiscardQueryParams = z.infer<
  typeof StockDiscardQueryParamsSchema
>

export type AddRemoveDiscardDataDTO = z.infer<typeof AddRemoveDiscardDataSchema>

export type AddRemoveDiscardReviewDatasetDTO = z.infer<
  typeof AddRemoveDiscardReviewDatasetSchema
>

export type AddRemoveDiscardReviewResponseDTO = z.infer<
  typeof AddRemoveDiscardReviewResponseSchema
>

export type AddRemoveDiscardDatasetDTO = z.infer<
  typeof AddRemoveDiscardDatasetSchema
>

export type AddRemoveDiscardPaginatedResponseDTO = z.infer<
  typeof AddRemoveDiscardPaginatedResponseSchema
>

export type AddRemoveDiscardExportFilterDTO = z.infer<
  typeof AddRemoveDiscardExportFilterSchema
>

export type TransactionReasonDTO = z.infer<typeof TransactionReasonSchema>

export type LastUpdatedDTO = z.infer<typeof LastUpdatedSchema>
