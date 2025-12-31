import { STOCK_INVENTORY_TRANSACTION_TYPE } from "@/common/constants/stock-inventory.js"
import { PeriodSchema } from "@/common/schemas/period.schema.js"
import { QueryParamsSchema } from "@/common/schemas/query-param.schema.js"
import { z } from "zod"

/**
 * Base query parameter validation schema for stock inventory modules
 * Shared between stock-availability and abnormal-stock modules
 */
export const StockInventoryBaseQueryParamsSchema = z.intersection(
  QueryParamsSchema,
  z.object({
    period: z.enum(["day", "week", "month"]).optional().default("month"),
  })
)

/**
 * Base data schema for stock inventory data from database
 * Shared between stock-availability and abnormal-stock modules
 */
export const StockInventoryDataSchema = z.object({
  entity_id: z.number(),
  master_material_id: z.number(),
  province_id: z.number(),
  regency_id: z.number(),
  location_id: z.number(),
  period: z.string(),
  opening_ehmm_balance: z.number().nullable(),
  opening_change_qty: z.number().nullable(),
  opening_ehmm_min: z.number().nullable(),
  opening_ehmm_max: z.number().nullable(),
  opening_previous_stock_condition: z.string(),
  opening_current_stock_condition: z.string(),
  opening_offset_duration: z.number().nullable(),
  opening_offset_frequency: z.number().nullable(),
  middle_ehmm_duration: z.number().nullable(),
  middle_ehmm_frequency: z.number().nullable(),
  closing_ehmm_balance: z.number().nullable(),
  closing_change_qty: z.number().nullable(),
  closing_ehmm_min: z.number().nullable(),
  closing_ehmm_max: z.number().nullable(),
  closing_previous_stock_condition: z.string(),
  closing_current_stock_condition: z.string(),
  closing_offset_duration: z.number().nullable(),
  closing_offset_frequency: z.number().nullable(),
  future_immediate_balance_condition: z.string().nullish(),
  total_duration_seconds: z.number(),
  total_frequency: z.number(),
})

/**
 * Last updated timestamp schema - shared across all endpoints
 */
export const StockInventoryLastUpdatedSchema = z.object({
  last_updated: z.string(),
})

/**
 * Base result item schema for calculations
 * Can be extended by specific modules for their metrics
 */
export const StockInventoryResultItemSchema = z.object({
  label: z.string(),
  // Stock availability metrics
  availability: z.number().or(z.string()).optional(),
  "90-100": z.number().or(z.string()).optional(),
  "70-89": z.number().or(z.string()).optional(),
  "50-69": z.number().or(z.string()).optional(),
  "<50": z.number().or(z.string()).optional(),
  // Abnormal stock metrics
  value: z.number().or(z.string()).optional(),
})

/**
 * Base dataset schema for material/entity/location endpoints
 * Shared structure between both modules
 */
export const StockInventoryListDatasetSchema = z.object({
  id: z.number(),
  name: z.string(),
  province_name: z.string().nullish(),
  regency_name: z.string().nullish(),
  period: z.array(StockInventoryResultItemSchema),
})

/**
 * Entity-Material specific dataset schema
 * Used by both modules for entity-material cross-analysis
 */
export const StockInventoryEntityMaterialDatasetSchema = z.object({
  id: z.number(),
  name: z.string(),
  province_name: z.string().nullable(),
  province_id: z.number().nullable(),
  regency_name: z.string().nullable(),
  regency_id: z.number().nullable(),
  period: z.array(StockInventoryResultItemSchema),
})

/**
 * Base response schema for paginated endpoints
 * Shared between material/entity/location endpoints
 */
export const StockInventoryListResponseSchema = z.object({
  last_updated: z.string(),
  data: z.object({
    categories: z.array(PeriodSchema),
    dataset: z.array(StockInventoryListDatasetSchema),
    type: z.array(z.object({ key: z.string(), label: z.string() })),
  }),
  page: z.number(),
  item_per_page: z.number(),
  total_item: z.number(),
  total_page: z.number(),
  list_pagination: z.array(z.number()),
})

/**
 * Entity-Material response schema
 * Shared between both modules
 */
export const StockInventoryEntityMaterialResponseSchema = z.object({
  last_updated: z.string(),
  data: z.object({
    categories: z.array(
      z.object({
        label: z.string(),
      })
    ),
    dataset: z.array(StockInventoryEntityMaterialDatasetSchema),
    type: z.array(z.object({ key: z.string(), label: z.string() })),
  }),
  page: z.number(),
  item_per_page: z.number(),
  total_item: z.number(),
  total_page: z.number(),
  list_pagination: z.array(z.number()),
})

// Base interface for items that can be processed
export interface ProcessableItem {
  id: number
  name: string
  province_name?: string | null
  province_id?: string | null
  regency_name?: string | null
  regency_id?: string | null
}

// Type exports - shared types
export type StockInventoryBaseQueryParams = z.infer<
  typeof StockInventoryBaseQueryParamsSchema
>
export type StockInventoryData = z.infer<typeof StockInventoryDataSchema>
export type StockInventoryResultItem = z.infer<
  typeof StockInventoryResultItemSchema
>
export type StockInventoryListDataset = z.infer<
  typeof StockInventoryListDatasetSchema
>
export type StockInventoryEntityMaterialDataset = z.infer<
  typeof StockInventoryEntityMaterialDatasetSchema
>
export type StockInventoryListResponse = z.infer<
  typeof StockInventoryListResponseSchema
>
export type StockInventoryEntityMaterialResponse = z.infer<
  typeof StockInventoryEntityMaterialResponseSchema
>

// Not to be confused with actual transaction-type
export type TransactionType =
  (typeof STOCK_INVENTORY_TRANSACTION_TYPE)[keyof typeof STOCK_INVENTORY_TRANSACTION_TYPE]
