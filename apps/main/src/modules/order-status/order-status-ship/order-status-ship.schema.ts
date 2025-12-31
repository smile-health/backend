import z from "zod"
import { IdParamsSchema, DateSchema } from "@smile/lib/types/param.js"

export type OrderStatusShipEntityDTO =
  | {
      id: number
      name: string | null
    }
  | undefined

/* Base Schema */
export const OrderStatusShipSchema = z.object({
  id: z.number().positive(),
  order_id: z.number().positive(),
  user_id: z.number().positive(),
  order_status_id: z.number().positive(),
  sales_ref: z.string().min(1).max(255).nullish(),
  taken_by_customer: z.number().nullish(),
  comment: z.string().nullish(),
  qty: z.number().positive(),
  allocated_qty: z.number().positive(),
  in_transit_qty: z.number().positive(),
  estimated_date: DateSchema.nullish(),
  actual_shipment_date: DateSchema,
  shipped_by: z.number().positive(),
  shipped_at: z.date(),
  stock_id: z.number().positive(),
  activity_id: z.number().positive(),
  entity_id: z.number().positive(),
  companion_entity_id: z.number().positive().optional(),
  entity_activity_id: z.number().positive().optional(),
  transaction_type_id: z.number().positive(),
  opening_qty: z.number(),
  change_qty: z.number(),
  device_type: z.number().positive(),
  batch_code: z.string().nullish(),
  created_by: z.number().positive(),
  updated_by: z.number().positive(),
  deleted_by: z.number().nullish(),
  created_at: z.date(),
  updated_at: z.date(),
  deleted_at: z.date().nullish(),
  transaction_id: z
    .string()
    .nullable()
    .transform((val) => {
      return val === null ? null : BigInt(val)
    }),
  budget_source_id: z.number().positive().nullable(),
  year: z.number().positive().nullable(),
  price: z.number().positive().nullable(),
  total_price: z.number().positive().nullable(),
  source_id: z
    .string()
    .nullable()
    .transform((val) => {
      return val === null ? null : BigInt(val)
    }),
  source_type: z.string().nullable(),
  batch_id: z
    .string()
    .nullable()
    .transform((val) => {
      return val === null ? null : BigInt(val)
    }),
  material_id: z
    .string()
    .nullable()
    .transform((val) => {
      return val === null ? null : BigInt(val)
    }),
  parent_material_id: z
    .string()
    .nullable()
    .transform((val) => {
      return val === null ? null : BigInt(val)
    }),
  unreceived_qty: z.number().positive().nullable(),
})

/* Request Body Schema */
export const ChangeOrderStatusShipRequestSchema = OrderStatusShipSchema.pick({
  sales_ref: true,
  estimated_date: true,
  taken_by_customer: true,
  actual_shipment_date: true,
  comment: true,
})

/* DTO Schema */
export const ChangeOrderStatusShipDTOSchema = OrderStatusShipSchema.pick({
  order_status_id: true,
  sales_ref: true,
  taken_by_customer: true,
  updated_by: true,
  updated_at: true,
})

export const AddOrderHistoryShipDTOSchema = OrderStatusShipSchema.pick({
  order_id: true,
  order_status_id: true,
  created_by: true,
  updated_by: true,
  created_at: true,
  updated_at: true,
})

export const UpdateOrderAuditShipDTOSchema = OrderStatusShipSchema.pick({
  estimated_date: true,
  actual_shipment_date: true,
  shipped_at: true,
  updated_at: true,
  shipped_by: true,
  updated_by: true,
})

export const AddOrderCommentShipDTOSchema = OrderStatusShipSchema.pick({
  order_id: true,
  user_id: true,
  order_status_id: true,
  comment: true,
  created_at: true,
  updated_at: true,
  created_by: true,
  updated_by: true,
})

const ChangeStockShipTypeA = OrderStatusShipSchema.pick({
  qty: true,
  allocated_qty: true,
  in_transit_qty: true,
  updated_by: true,
  updated_at: true,
})

const ChangeStockShipTypeB = OrderStatusShipSchema.pick({
  unreceived_qty: true,
  updated_at: true,
})

export const ChangeStockShipDTOSchema = z.union([
  ChangeStockShipTypeA,
  ChangeStockShipTypeB,
])

export const AddTransactionShipDTOSchema = OrderStatusShipSchema.pick({
  activity_id: true,
  opening_qty: true,
  change_qty: true,
  transaction_type_id: true,
  entity_id: true,
  companion_entity_id: true,
  entity_activity_id: true,
  stock_id: true,
  order_id: true,
  device_type: true,
  batch_code: true,
  created_at: true,
  updated_at: true,
  created_by: true,
  updated_by: true,
})

export const AddPurchaseShipDTOSchema = OrderStatusShipSchema.pick({
  transaction_id: true,
  budget_source_id: true,
  year: true,
  price: true,
  total_price: true,
  created_by: true,
  updated_by: true,
  created_at: true,
  updated_at: true,
  source_id: true,
  source_type: true,
})

export const AddStockCustomerShipDTOSchema = OrderStatusShipSchema.pick({
  qty: true,
  batch_id: true,
  entity_id: true,
  activity_id: true,
  material_id: true,
  updated_by: true,
  updated_at: true,
  parent_material_id: true,
  unreceived_qty: true,
})

/* Path Params Schema */
export const GetDetailOrderSchema = IdParamsSchema

/* Request Body Type */
export type ChangeOrderStatusShipRequest = z.infer<
  typeof ChangeOrderStatusShipRequestSchema
>

/* DTO Type */

export type ChangeOrderStatusShipDTO = z.infer<
  typeof ChangeOrderStatusShipDTOSchema
>

export type AddOrderHistoryShipDTO = z.infer<
  typeof AddOrderHistoryShipDTOSchema
>

export type UpdateOrderAuditShipDTO = z.infer<
  typeof UpdateOrderAuditShipDTOSchema
>

export type AddOrderCommentShipDTO = z.infer<
  typeof AddOrderCommentShipDTOSchema
>

export type ChangeStockShipDTO = z.infer<typeof ChangeStockShipDTOSchema>

export type AddTransactionShipDTO = z.infer<typeof AddTransactionShipDTOSchema>

export type AddPurchaseShipDTO = z.infer<typeof AddPurchaseShipDTOSchema>

export type AddStockCustomerShipDTO = z.infer<
  typeof AddStockCustomerShipDTOSchema
>
