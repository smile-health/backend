import { QueryParamsSchema } from "@/common/schemas/query-param.schema.js"
import { z } from "zod"
import { PeriodSchema } from "@/common/schemas/period.schema.js"

// Order-response specific query params using intersection
const OrderResponseSpecificParamsSchema = z.object({
  period: z.enum(["month", "day", "week"]).default("month"),
})

export const OrderResponseQueryParamsSchema = QueryParamsSchema.and(
  OrderResponseSpecificParamsSchema
)
export type OrderResponseQueryParams = z.infer<
  typeof OrderResponseQueryParamsSchema
>

// Data transfer object schema for order response

// Data transfer object schema for order response
export const OrderResponseDataSchema = z.object({
  order_id: z.number(),
  activity_name: z.string(),
  activity_id: z.number(),
  material_id_array: z.number(),
  customer_province_name: z.string(),
  customer_province_id: z.number(),
  customer_regency_name: z.string(),
  customer_regency_id: z.number(),
  customer_name: z.string(),
  customer_id: z.number(),
  location_id: z.number(),
  month: z.number(),
  year: z.number(),
  week: z.number(),
  day: z.string(),
  doa: z.number(), // duration order to allocation (days)
  das: z.number(), // duration allocation to shipped (days)
  dsr: z.number(), // duration shipped to received (days)
})

export type OrderResponseDataDTO = z.infer<typeof OrderResponseDataSchema>

export const OrderResponseReviewDatasetSchema = z.object({
  label: z.string(),
  color: z.string(),
  data: z.array(z.number()),
})

export type OrderResponseReviewDatasetDTO = z.infer<
  typeof OrderResponseReviewDatasetSchema
>

// Review response schema
export const OrderResponseReviewResponseSchema = z.object({
  last_updated: z.string(),
  data: z.object({
    categories: z.array(PeriodSchema),
    dataset: z.array(OrderResponseReviewDatasetSchema),
  }),
})

export type OrderResponseReviewResponse = z.infer<
  typeof OrderResponseReviewResponseSchema
>

// Period data schema for material/entity/location responses
const PeriodDataSchema = z.object({
  doa: z.number(),
  das: z.number(),
  dsr: z.number(),
})

// Dataset item schema for material/entity/location responses
const DatasetItemSchema = z.object({
  id: z.number(),
  name: z.string(),
  province_name: z.string().nullable().optional(),
  regency_name: z.string().nullable().optional(),
  period: z.array(PeriodDataSchema),
})

export type OrderResponseDatasetDTO = z.infer<typeof DatasetItemSchema>

// Pagination schema
const PaginationSchema = z.object({
  page: z.number(),
  item_per_page: z.number(),
  total_item: z.number(),
  total_page: z.number(),
  list_pagination: z.array(z.number()),
})

// Unified paginated response schema for material/entity/location endpoints
export const OrderResponsePaginatedResponseSchema = z
  .object({
    last_updated: z.string(),
    data: z.object({
      categories: z.array(PeriodSchema),
      dataset: z.array(DatasetItemSchema),
      type: z.array(z.object({ key: z.string(), label: z.string() })),
    }),
  })
  .merge(PaginationSchema)

export type OrderResponsePaginatedResponse = z.infer<
  typeof OrderResponsePaginatedResponseSchema
>
