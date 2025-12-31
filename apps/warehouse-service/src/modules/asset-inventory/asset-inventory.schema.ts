import { QueryParamsSchema } from "@/common/schemas/query-param.schema.js"
import { z } from "zod"

/**
 * Query parameter validation schema using intersection with common QueryParamsSchema
 */
export const AssetInventoryQueryParamsSchema = z.intersection(
  QueryParamsSchema,
  z.object({
    entity_type_ids: z.preprocess(
      (val) => (typeof val === "string" ? val.split(",").map(Number) : val),
      z.array(z.number()).optional()
    ),
    type_ids: z.preprocess(
      (val) => (typeof val === "string" ? val.split(",").map(Number) : val),
      z.array(z.number()).optional()
    ),
    manufacture_ids: z.preprocess(
      (val) => (typeof val === "string" ? val.split(",").map(Number) : val),
      z.array(z.number()).optional()
    ),
    province_ids: z.preprocess(
      (val) => (typeof val === "string" ? val.split(",").map(Number) : val),
      z.array(z.number()).optional()
    ),
    regency_ids: z.preprocess(
      (val) => (typeof val === "string" ? val.split(",").map(Number) : val),
      z.array(z.number()).optional()
    ),
    entity_ids: z.preprocess(
      (val) => (typeof val === "string" ? val.split(",").map(Number) : val),
      z.array(z.number()).optional()
    ),
    entity_tag_ids: z.preprocess(
      (val) => (typeof val === "string" ? val.split(",").map(Number) : val),
      z.array(z.number()).optional()
    ),
    model_ids: z.preprocess(
      (val) => (typeof val === "string" ? val.split(",").map(Number) : val),
      z.array(z.number()).optional()
    ),
    statuses: z.preprocess(
      (val) => (typeof val === "string" ? val.split(",").map(Number) : val),
      z.array(z.number()).optional()
    ),
    power_available_ids: z.preprocess(
      (val) => (typeof val === "string" ? val.split(",").map(Number) : val),
      z.array(z.number()).optional()
    ),
    ownership_status_ids: z.preprocess(
      (val) => (typeof val === "string" ? val.split(",").map(Number) : val),
      z.array(z.number()).optional()
    ),
    prod_years: z.preprocess(
      (val) => (typeof val === "string" ? val.split(",").map(Number) : val),
      z.array(z.number()).optional()
    ),
    vendor_ids: z.preprocess(
      (val) => (typeof val === "string" ? val.split(",").map(Number) : val),
      z.array(z.number()).optional()
    ),
    communication_provider_ids: z.preprocess(
      (val) => (typeof val === "string" ? val.split(",").map(Number) : val),
      z.array(z.number()).optional()
    ),
    asset_capacity_ids: z.preprocess(
      (val) => (typeof val === "string" ? val.split(",").map(Number) : val),
      z.array(z.number()).optional()
    ),
    budget_years: z.preprocess(
      (val) => (typeof val === "string" ? val.split(",").map(Number) : val),
      z.array(z.number()).optional()
    ),
    working_status_ids: z.preprocess(
      (val) => (typeof val === "string" ? val.split(",").map(Number) : val),
      z.array(z.number()).optional()
    ),
    is_deleted: z.any().optional(),
    rtmd_type_id: z.number().nullish()
  })
)

// Data Transfer Object schemas
export const AssetOwnershipOverviewDTO = z.object({
  element_id: z.number(), // can be entity_tag_id, entity_id, or regency_id
  type_id: z.number(),
  qty: z.number(),
})

export const AssetInventoryOverviewDetailSchema = z.object({
  id: z.number(),
  title: z.string(),
  total: z.number(),
  color: z.string(),
})

export const AssetInventoryOverviewDataSchema = z.object({
  id: z.number().optional(), // Make id optional to match the config structure
  title: z.string(),
  details: z.array(AssetInventoryOverviewDetailSchema),
  total: z.number(),
})

export const AssetInventoryOverviewResponseSchema = z.object({
  date: z.string(),
  data: z.array(AssetInventoryOverviewDataSchema),
})

// Inferred TypeScript types from Zod schemas
export type AssetInventoryQueryParams = z.infer<
  typeof AssetInventoryQueryParamsSchema
>
export type AssetOwnershipOverviewDTO = z.infer<
  typeof AssetOwnershipOverviewDTO
>
export type AssetInventoryOverviewResponse = z.infer<
  typeof AssetInventoryOverviewResponseSchema
>

export interface DashboardConfig {
  tabs: {
    title: string
    entity_tag_ids: number[]
  }[]
  card_colors: string[]
  rtmd_type_id: number
}

export interface AssetType {
  id: number
  name: string
}

export type AssetInventoryTableDTO = {
  id: number
  name: string
  qty_by_type: Map<string, number>
  total_qty: number
}
