import z from "zod"
import { IdParamsSchema } from "@smile/lib/types/param.js"

/* Base Schema */
export const OrderStatusCancelSchema = z.object({
  id: z.number().positive(),
  order_id: z.number().positive(),
  user_id: z.number().positive(),
  order_status_id: z.number().positive(),
  order_cancel_reason_id: z.number().positive().nullish(),
  other_reason: z.string().nullish(),
  source_id: z.number().positive(),
  source_type: z.string(),
  content: z.string(),
  comment: z.string().nullish(),
  qty: z.number().positive(),
  allocated_qty: z.number().positive(),
  in_transit_qty: z.number().positive(),
  cancelled_by: z.number().positive(),
  cancelled_at: z.date(),
  stock_id: z.number().positive(),
  activity_id: z.number().positive(),
  entity_id: z.number().positive(),
  material_id: z.number().positive(),
  transaction_type_id: z.number().positive(),
  opening_qty: z.number(),
  change_qty: z.number(),
  device_type: z.number().positive(),
  batch_code: z.string().nullish(),
  is_allocated: z.number(),
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
  batch_id: z
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
export const ChangeOrderStatusCancelRequestSchema =
  OrderStatusCancelSchema.pick({
    order_cancel_reason_id: true,
    other_reason: true,
    comment: true,
  })

/* DTO Schema */
export const ChangeOrderItemStockCancelAllocatedDTOSchema =
  OrderStatusCancelSchema.pick({
    allocated_qty: true,
    updated_at: true,
    updated_by: true,
  })

export const ChangeOrderStatusCancelDTOSchema = OrderStatusCancelSchema.pick({
  order_status_id: true,
  is_allocated: true,
  updated_by: true,
  updated_at: true,
  order_cancel_reason_id: true,
})

export const AddOrderHistoryCancelDTOSchema = OrderStatusCancelSchema.pick({
  order_id: true,
  order_status_id: true,
  created_by: true,
  updated_by: true,
  created_at: true,
  updated_at: true,
})

export const UpdateOrderAuditCancelDTOSchema = OrderStatusCancelSchema.pick({
  cancelled_at: true,
  updated_at: true,
  cancelled_by: true,
  updated_by: true,
})

export const AddOtherReasonCancelDTOSchema = OrderStatusCancelSchema.pick({
  source_id: true,
  source_type: true,
  content: true,
  created_at: true,
  updated_at: true,
})

export const AddOrderCommentCancelDTOSchema = OrderStatusCancelSchema.pick({
  order_id: true,
  user_id: true,
  order_status_id: true,
  comment: true,
  created_at: true,
  updated_at: true,
  created_by: true,
  updated_by: true,
})

const ChangeStockShipTypeA = OrderStatusCancelSchema.pick({
  qty: true,
  in_transit_qty: true,
  updated_by: true,
  updated_at: true,
})

const ChangeStockShipTypeB = OrderStatusCancelSchema.pick({
  unreceived_qty: true,
  updated_by: true,
  updated_at: true,
})

export const ChangeStockShipToCancelDTOSchema = z.union([
  ChangeStockShipTypeA,
  ChangeStockShipTypeB,
])

export const ChangeStockAllocateToCancelDTOSchema =
  OrderStatusCancelSchema.pick({
    allocated_qty: true,
    updated_by: true,
    updated_at: true,
  })

export const AddTransactionCancelDTOSchema = OrderStatusCancelSchema.pick({
  activity_id: true,
  opening_qty: true,
  change_qty: true,
  transaction_type_id: true,
  entity_id: true,
  stock_id: true,
  order_id: true,
  device_type: true,
  batch_code: true,
  created_at: true,
  updated_at: true,
  created_by: true,
  updated_by: true,
})

export const AddStockCustomerCancelDTOSchema = OrderStatusCancelSchema.pick({
  qty: true,
  batch_id: true,
  entity_id: true,
  activity_id: true,
  material_id: true,
  updated_by: true,
  updated_at: true,
  parent_material_id: true,
})

export const AddPurchaseCancelDTOSchema = OrderStatusCancelSchema.pick({
  transaction_id: true,
  budget_source_id: true,
  year: true,
  price: true,
  total_price: true,
  created_by: true,
  updated_by: true,
  created_at: true,
  updated_at: true,
  source_type: true,
}).extend({
  source_id: z
    .string()
    .nullable()
    .transform((val) => {
      return val === null ? null : BigInt(val)
    }),
})

/* Path Params Schema */
export const GetDetailOrderSchema = IdParamsSchema

/* Request Body Type */
export type ChangeOrderStatusCancelRequest = z.infer<
  typeof ChangeOrderStatusCancelRequestSchema
>

/* DTO Type */
export type ChangeOrderItemStockCancelAllocatedDTO = z.infer<
  typeof ChangeOrderItemStockCancelAllocatedDTOSchema
>

export type ChangeOrderStatusCancelDTO = z.infer<
  typeof ChangeOrderStatusCancelDTOSchema
>

export type AddOrderHistoryCancelDTO = z.infer<
  typeof AddOrderHistoryCancelDTOSchema
>

export type UpdateOrderAuditCancelDTO = z.infer<
  typeof UpdateOrderAuditCancelDTOSchema
>

export type AddOtherReasonCancelDTO = z.infer<
  typeof AddOtherReasonCancelDTOSchema
>

export type AddOrderCommentCancelDTO = z.infer<
  typeof AddOrderCommentCancelDTOSchema
>

export type ChangeStockShipToCancelDTO = z.infer<
  typeof ChangeStockShipToCancelDTOSchema
>

export type ChangeStockAllocateToCancelDTO = z.infer<
  typeof ChangeStockAllocateToCancelDTOSchema
>

export type AddTransactionCancelDTO = z.infer<
  typeof AddTransactionCancelDTOSchema
>

export type AddStockCustomerCancelDTO = z.infer<
  typeof AddStockCustomerCancelDTOSchema
>

export type AddPurchaseCancelDTO = z.infer<typeof AddPurchaseCancelDTOSchema>
