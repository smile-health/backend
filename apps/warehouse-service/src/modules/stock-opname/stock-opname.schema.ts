import { QueryParamsSchema } from "@/common/schemas/query-param.schema.js"
import { DateSchema, IdSchema } from "@smile-health/lib/types/param.js"
import { z } from "zod"

/* Schemas */
export const StockOpnameSchema = z.object({
  stock_opname_id: IdSchema,
  entity_id: IdSchema,
  entity_name: z.string().nullish(),
  province_id: IdSchema,
  province_name: z.string(),
  regency_id: IdSchema,
  regency_name: z.string(),
  entity_tag_id: IdSchema,
  entity_tag_title: z.string().nullish(),
  stock_opname_activity_id: IdSchema.nullish(),
  stock_opname_material_id: IdSchema.nullish(),
  stock_opname_master_material_id: IdSchema.nullish(),
  stock_opname_batch_code: z.string().nullish(),
  stock_opname_expired_date: z
    .preprocess((arg) => {
      if (typeof arg === "string" || arg instanceof Date) return new Date(arg)
    }, z.date())
    .nullish(),
  stock_opname_smile_qty: z.number(),
  stock_opname_real_qty: z.number(),
  stock_opname_unsubmit_distribution_qty: z.number(),
  stock_opname_created_by: IdSchema.nullish(),
  stock_opname_updated_by: IdSchema.nullish(),
  stock_opname_created_at: z.preprocess((arg) => {
    if (typeof arg === "string" || arg instanceof Date) return new Date(arg)
  }, z.date()),
  stock_opname_updated_at: z.preprocess((arg) => {
    if (typeof arg === "string" || arg instanceof Date) return new Date(arg)
  }, z.date()),
  stock_opname_deleted_at: z
    .preprocess((arg) => {
      if (typeof arg === "string" || arg instanceof Date) return new Date(arg)
    }, z.date())
    .nullish(),
  ed_qty: z.number(),
  stock_opname_period_id: IdSchema.nullish(),
  stock_opname_period_status: IdSchema.nullish(),
  stock_opname_program_id: IdSchema,
  ingested_at: z
    .preprocess((arg) => {
      if (typeof arg === "string" || arg instanceof Date) return new Date(arg)
    }, z.date())
    .default(new Date()), // DEFAULT formatDateTime(now(), '%Y-%m-%d %H:%i:%S', 'Asia/Jakarta')
  version: z
    .number()
    .int()
    .default(Math.floor(Date.now() / 1000)), // DEFAULT toUnixTimestamp(now())
})

export const StockOpnameQueryParamsSchema = QueryParamsSchema

export const StockOpnameComplianceItemDTOSchema = z.object({
  entity_tag_id: IdSchema.nullish(),
  location_id: IdSchema.nullish(),
  count: z.number().positive(),
})

export const StockOpnameComplianceDTOSchema = z.array(
  StockOpnameComplianceItemDTOSchema
)

export const StockOpnameResultItemDTOSchema = z.object({
  entity_tag_id: IdSchema.nullish(),
  location_id: IdSchema.nullish(),
  entity_name: z.string().nullish(),
  province_name: z.string().nullish(),
  regency_name: z.string().nullish(),
  entity_tag_name: z.string().nullish(),
  stock: z.number().nonnegative(),
  exp_stock: z.number().nonnegative(),
  stock_in_transit: z.number().nonnegative(),
  real_stock: z.number().nonnegative(),
  difference: z.number().nonnegative(),
  difference_percentage: z.number().nonnegative(),
})

export const StockOpnameResultDTOSchema = z.array(
  StockOpnameResultItemDTOSchema
)

export const StockOpnameResponse = z.object({
  date: DateSchema,
  page: z.number().positive(),
  item_per_page: z.number().positive(),
  total_item: z.number().nonnegative(),
  total_page: z.number().nonnegative(),
  list_pagination: z.array(z.number().positive()),
})

export const StockOpnameComplianceSchema = z.object({
  row: z.number().positive(),
  province_name: z.string().nullish(),
  regency_name: z.string().nullish(),
  entity_tag_name: z.string().nullish(),
  not_yet: z.number().nonnegative(),
  done: z.number().nonnegative(),
  entity_total: z.number().nonnegative(),
  not_yet_percentage: z.number(),
  done_percentage: z.number(),
  entity_total_percentage: z.number(),
})

export const StockOpnameComplianceSummaryResponseDataSchema = z.array(
  StockOpnameComplianceSchema.extend({
    entity_tag: z.object({
      id: IdSchema,
      name: z.string(),
    }),
  })
)

export const StockOpnameComplianceResponseDataSchema = z.array(
  StockOpnameComplianceSchema.extend({
    entity: z.object({
      id: IdSchema,
      name: z.string(),
    }),
  })
)

export const StockOpnameResultSchema = z.object({
  row: z.number().positive(),
  province_name: z.string().nullish(),
  regency_name: z.string().nullish(),
  entity_tag_name: z.string().nullish(),
  stock: z.number().nonnegative(),
  exp_stock: z.number().nonnegative(),
  stock_in_transit: z.number().nonnegative(),
  real_stock: z.number().nonnegative(),
  difference: z.number().nonnegative(),
  difference_percentage: z.number().nonnegative(),
})

export const StockOpnameResultSummmaryResponseDataSchema = z.array(
  StockOpnameResultSchema.extend({
    entity_tag: z.object({
      id: IdSchema,
      name: z.string(),
    }),
  })
)

export const StockOpnameResultResponseDataSchema = z.array(
  StockOpnameResultSchema.extend({
    entity: z.object({
      id: IdSchema,
      name: z.string(),
    }),
  })
)

export const StockOpnameComplianceSummaryResponseSchema = z.object({
  date: DateSchema,
  data: StockOpnameComplianceSummaryResponseDataSchema,
})

export const StockOpnameComplianceResponseSchema = StockOpnameResponse.extend({
  data: StockOpnameComplianceResponseDataSchema,
})

export const StockOpnameResultSummaryResponseSchema = z.object({
  date: DateSchema,
  data: StockOpnameResultSummmaryResponseDataSchema,
})

export const StockOpnameResultResponseSchema = StockOpnameResponse.extend({
  data: StockOpnameResultResponseDataSchema,
})

export const StockOpnameMaterialItemDTOSchema = z.object({
  location_id: IdSchema,
  material_id: IdSchema,
  smile_qty: z.number(),
  real_qty: z.number(),
})

export const StockOpnameMaterialDTO = z.array(StockOpnameMaterialItemDTOSchema)

export const MaterialItemSchema = z.object({
  id: IdSchema,
  name: z.string(),
  smile_stock: z.union([z.number(), z.literal("-")]),
  real_stock: z.union([z.number(), z.literal("-")]),
  is_different: z.boolean(),
})

export const StockOpnameMaterialResponseDataSchema = z.array(
  z.object({
    row: z.number().positive(),
    entity: z.object({
      id: IdSchema,
      name: z.string(),
    }),
    province_name: z.string().nullish(),
    regency_name: z.string().nullish(),
    entity_tag_name: z.string().nullish(),
    entity_name: z.string().nullish(),
    materials: z.array(MaterialItemSchema),
    opname_recap: z.string(),
  })
)

export const StockOpnameMaterialResponseSchema = StockOpnameResponse.extend({
  data: StockOpnameMaterialResponseDataSchema,
  materials: z.array(
    z.object({
      id: IdSchema,
      name: z.string(),
    })
  ),
})

/* Types */
export type StockOpname = z.infer<typeof StockOpnameSchema>

export type StockOpnameQueryParams = z.infer<
  typeof StockOpnameQueryParamsSchema
>

export type StockOpnameComplianceItemDTO = z.infer<
  typeof StockOpnameComplianceItemDTOSchema
>
export type StockOpnameComplianceDTO = z.infer<
  typeof StockOpnameComplianceDTOSchema
>

export type StockOpnameResultItemDTO = z.infer<
  typeof StockOpnameResultItemDTOSchema
>
export type StockOpnameResultDTO = z.infer<typeof StockOpnameResultDTOSchema>

export type StockOpnameComplianceResponseData = z.infer<
  typeof StockOpnameComplianceResponseDataSchema
>

export type StockOpnameResultResponseData = z.infer<
  typeof StockOpnameResultResponseDataSchema
>

export type StockOpnameComplianceSummaryResponse = z.infer<
  typeof StockOpnameComplianceSummaryResponseSchema
>

export type StockOpnameComplianceResponse = z.infer<
  typeof StockOpnameComplianceResponseSchema
>

export type StockOpnameResultSummaryResponse = z.infer<
  typeof StockOpnameResultSummaryResponseSchema
>

export type StockOpnameResultResponse = z.infer<
  typeof StockOpnameResultResponseSchema
>

export type StockOpnameMaterialItemDTO = z.infer<
  typeof StockOpnameMaterialItemDTOSchema
>
export type StockOpnameMaterialDTO = z.infer<typeof StockOpnameMaterialDTO>

export type MaterialItem = z.infer<typeof MaterialItemSchema>

export type StockOpnameMaterialResponseData = z.infer<
  typeof StockOpnameMaterialResponseDataSchema
>

export type StockOpnameMaterialResponse = z.infer<
  typeof StockOpnameMaterialResponseSchema
>
