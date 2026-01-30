import { QueryParamsSchema } from "@/common/schemas/query-param.schema.js"
import { DateSchema, IdSchema } from "@smile-health/lib/types/param.js"
import moment from "moment"
import { z } from "zod"

export const StockBookSchema = z.object({
  transactions_id: IdSchema,
  program_id: IdSchema,
  transactions_transaction_type_id: IdSchema.nullish(),
  transactions_order_id: IdSchema.nullish(),
  transactions_customer_id: IdSchema.nullish(),
  transactions_vendor_id: IdSchema.nullish(),
  transactions_stock_id: IdSchema.nullish(),
  transactions_master_material_id: IdSchema.nullish(),
  transactions_activity_id: IdSchema.nullish(),
  transactions_activity_name: z.string().nullish(),
  transactions_created_at: z.string(),
  transactions_updated_at: z.string().nullish(),
  transactions_transaction_reason_id: IdSchema.nullish(),
  join_date: DateSchema.nullish(),
  end_date: DateSchema.nullish(),
  transactions_deleted_at: z.string().nullish(),
  transactions_change_qty: z.number().nullish(),
  transactions_opening_qty: z.number().nullish(),
  batches_id: IdSchema.nullish(),
  batches_code: z.string().nullish(),
  entities_id: IdSchema.nullish(),
  entities_is_vendor: z.number().nullish(),
  entities_status: z.number().nullish(),
  entities_type: z.number().nullish(),
  entities_name: z.string().nullish(),
  entities_code: z.string().nullish(),
  entities_province_id: IdSchema.nullish(),
  entities_regency_id: IdSchema.nullish(),
  entities_province_name: z.string().nullish(),
  entities_regency_name: z.string().nullish(),
  entities_entity_tag_id: IdSchema.nullish(),
  entity_tags_id: IdSchema.nullish(),
  entity_tags_title: z.string().nullish(),
  stock_activity_id: IdSchema.nullish(),
  stock_activity_name: z.string().nullish(),
  dmm_name: z.string().nullish(),
  dmm_unit_of_consumption_name: z.string().nullish(),
  dmm_unit_of_distribution_name: z.string().nullish(),
  dmm_parent_id: IdSchema.nullish(),
  material_type_id: IdSchema.nullish(),
  material_type_name: z.string().nullish(),
  expired_date: DateSchema.nullish(),
  orders_order_type_id: IdSchema.nullish(),
  orders_order_status_id: IdSchema.nullish(),
  manufacture_id: IdSchema.nullish(),
  manufacture_name: z.string().nullish(),
  orders_order_customer_id: IdSchema.nullish(),
  orders_order_vendor_id: IdSchema.nullish(),
  customer_name: z.string().nullish(),
  vendor_name: z.string().nullish(),
  transactions_transaction_type_name: z.string().nullish(),
  transactions_transaction_reason_name: z.string().nullish(),
})

export const StockBookQueryParamsSchema = z
  .intersection(
    QueryParamsSchema,
    z.object({
      month: z.string(),
      year: z.string(),
    })
  )
  .transform((queryParams) => ({
    ...queryParams,
    to: moment(`${queryParams.year}-${queryParams.month}`)
      .endOf("month")
      .format("YYYY-MM-DD HH:mm:ss"),
  }))

export const StockBookItemDTOSchema = z.object({
  entity_name: z.string(),
  customer_name: z.string(),
  vendor_name: z.string(),
  transaction_type_id: IdSchema,
  transaction_change_type_id: IdSchema,
  transaction_created_at: DateSchema,
  transaction_opening_qty: z.number(),
  transaction_change_qty: z.number(),
  transaction_closing_qty: z.number(),
  material_id: IdSchema,
  material_name: z.string(),
  material_type_id: IdSchema,
  material_type_name: z.string(),
  material_unit_of_consumption_name: z.string(),
  batch_code: z.string().nullish(),
  batch_expired_date: DateSchema.nullish(),
  transaction_activity: IdSchema,
  transaction_activity_name: z.string(),
  stock_activity_id: IdSchema,
  stock_activity_name: z.string(),
  transaction_reason_name: z.string(),
  transaction_other_reason: z.string().nullish(),
  quantity: z.number().int(),
  is_closing: z.boolean().nullish(),
})

export const StockBookDTOSchema = z.array(StockBookItemDTOSchema)

export const EntityMaterialActivityItemDTOSchema = z.object({
  material_id: IdSchema,
  material_name: z.string(),
  material_type_name: z.string(),
})

export const EntityMaterialActivityDTOSchema = z.array(
  EntityMaterialActivityItemDTOSchema
)

export const MapStockBookOptionDataItemDTOSchema = z.object({
  receive_entity_name: z.string(),
  receive_date: z.string(),
  receive_quantity: z.number().nullish(),
  receive_unit: z.string(),
  receive_batched_code: z.string().nullish(),
  receive_expired_date: z.string().nullish(),
  receive_activity: z.string(),
  receive_taken_from_activity: z.string(),
  issue_entity_name: z.string(),
  issue_date: z.string(),
  issue_quantity: z.number().nullish(),
  issue_unit: z.string(),
  issue_batched_code: z.string().nullish(),
  issue_expired_date: z.string().nullish(),
  issue_activity: z.string(),
  issue_taken_from_activity: z.string(),
  cumulative_balance: z.number().nullish(),
  additional_info: z.string().nullish(),
  reason: z.string(),
})

export const MapStockBookOptionDataDTOSchema = z.array(
  MapStockBookOptionDataItemDTOSchema
)

export type StockBook = z.infer<typeof StockBookSchema>
export type StockBookQueryParams = z.infer<typeof StockBookQueryParamsSchema>
export type StockBookItemDTO = z.infer<typeof StockBookItemDTOSchema>
export type StockBookDTO = z.infer<typeof StockBookDTOSchema>
export type EntityMaterialActivityItemDTO = z.infer<
  typeof EntityMaterialActivityItemDTOSchema
>
export type EntityMaterialActivityDTO = z.infer<
  typeof EntityMaterialActivityDTOSchema
>
export type MapStockBookOptionDataItemDTO = z.infer<
  typeof MapStockBookOptionDataItemDTOSchema
>
export type MapStockBookOptionDataDTO = z.infer<
  typeof MapStockBookOptionDataDTOSchema
>
