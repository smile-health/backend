import { DateSchema, IdParamsSchema } from "@smile/lib/types/param.js"
import z from "zod"

/* Base Schema */
export const OrderStatusFulfilledSchema = z.object({
  id: z.number().positive(),
  order_id: z.number().positive(),
  user_id: z.number().positive(),
  order_status_id: z.number().positive(),
  comment: z.string().nullish(),
  qty: z.number().positive(),
  in_transit_qty: z.number().positive(),
  received_qty: z.number().positive(),
  fulfilled_by: z.number().positive(),
  fulfilled_at: DateSchema,
  stock_id: z.number().positive(),
  activity_id: z.number().positive(),
  entity_id: z.number().positive(),
  material_id: z.number().positive(),
  transaction_type_id: z.number().positive(),
  opening_qty: z.number(),
  change_qty: z.number(),
  device_type: z.number().positive(),
  batch_id: z.number().positive(),
  batch_code: z.string().nullish(),
  created_by: z.number().positive(),
  updated_by: z.number().positive(),
  deleted_by: z.number().nullish(),
  created_at: z.date(),
  updated_at: z.date(),
  deleted_at: z.date().nullish(),
  fulfill_stock_status_id: z.number().positive().nullish(),
  parent_material_id: z.number().positive().nullable(),
  unreceived_qty: z.number().positive(),
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
})

/* Request Body Schema */
const nonHierarchySchema = OrderStatusFulfilledSchema.pick({
  id: true,
}).extend({
  receives: z.array(
    OrderStatusFulfilledSchema.pick({
      stock_id: true,
      received_qty: true,
      fulfill_stock_status_id: true,
    })
  ),
})

const ReceiveSchema = z.object({
  stock_id: z.number(),
  received_qty: z.number(),
  fulfill_stock_status_id: z.number().positive().nullish(),
})

const ChildSchema = z.object({
  id: z.number(),
  receives: z.array(ReceiveSchema).optional(),
})

const hierarchySchema = z.object({
  id: z.number(),
  children: z.array(ChildSchema).optional(),
})

const OrderSchema = z.object({
  order_items: z.array(z.union([nonHierarchySchema, hierarchySchema])),
  fulfilled_at: DateSchema,
  comment: z.string().nullish(),
})

export const ChangeOrderStatusFulfilledRequestSchema = OrderSchema

export const ChangeOrderItemStockFulfilledRequestSchema =
  OrderStatusFulfilledSchema.pick({
    id: true,
    received_qty: true,
    updated_by: true,
    updated_at: true,
  })

/* DTO Schema */
export const ChangeOrderItemStockFulfilledDTOSchema =
  ChangeOrderItemStockFulfilledRequestSchema.omit({
    id: true,
  }).extend({
    fulfill_stock_status_id: z.number().positive().nullish(),
  })

export const ChangeOrderStatusFulfilledDTOSchema =
  OrderStatusFulfilledSchema.pick({
    order_status_id: true,
    updated_by: true,
    updated_at: true,
  })

export const AddOrderHistoryFulfilledDTOSchema =
  OrderStatusFulfilledSchema.pick({
    order_id: true,
    order_status_id: true,
    created_by: true,
    updated_by: true,
    created_at: true,
    updated_at: true,
  })

export const UpdateOrderAuditFulfilledDTOSchema =
  OrderStatusFulfilledSchema.pick({
    fulfilled_at: true,
    updated_at: true,
    fulfilled_by: true,
    updated_by: true,
  })

export const AddOrderCommentFulfilledDTOSchema =
  OrderStatusFulfilledSchema.pick({
    order_id: true,
    user_id: true,
    order_status_id: true,
    comment: true,
    created_at: true,
    updated_at: true,
    created_by: true,
    updated_by: true,
  })

export const ChangeStockVendorFulfilledDTOSchema =
  OrderStatusFulfilledSchema.pick({
    in_transit_qty: true,
    updated_by: true,
    updated_at: true,
  })

export const ChangeStockCustomerFulfilledDTOSchema =
  OrderStatusFulfilledSchema.pick({
    qty: true,
    updated_by: true,
    updated_at: true,
    unreceived_qty: true,
  })

export const AddStockCustomerFulfilledDTOSchema =
  OrderStatusFulfilledSchema.pick({
    qty: true,
    batch_id: true,
    entity_id: true,
    activity_id: true,
    material_id: true,
    updated_by: true,
    updated_at: true,
    parent_material_id: true,
  })

export const AddTransactionFulfilledDTOSchema = OrderStatusFulfilledSchema.pick(
  {
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
  }
)

export const ChangeStockVendorCustomerFulfilledDTOSchema = z.union([
  ChangeStockVendorFulfilledDTOSchema,
  ChangeStockCustomerFulfilledDTOSchema,
])

export const AddPurchaseFulfillDTOSchema = OrderStatusFulfilledSchema.pick({
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

/* Path Params Schema */
export const GetDetailOrderSchema = IdParamsSchema

/* Request Body Type */
export type ChangeOrderStatusFulfilledRequest = z.infer<
  typeof ChangeOrderStatusFulfilledRequestSchema
>

export type ChangeOrderItemStockFulfilledRequest = z.infer<
  typeof ChangeOrderItemStockFulfilledRequestSchema
>

/* DTO Type */
export type ChangeOrderItemStockFulfilledDTO = z.infer<
  typeof ChangeOrderItemStockFulfilledDTOSchema
>

export type ChangeOrderStatusFulfilledDTO = z.infer<
  typeof ChangeOrderStatusFulfilledDTOSchema
>

export type AddOrderHistoryFulfilledDTO = z.infer<
  typeof AddOrderHistoryFulfilledDTOSchema
>

export type UpdateOrderAuditFulfilledDTO = z.infer<
  typeof UpdateOrderAuditFulfilledDTOSchema
>

export type AddOrderCommentFulfilledDTO = z.infer<
  typeof AddOrderCommentFulfilledDTOSchema
>

export type ChangeStockVendorFulfilledDTO = z.infer<
  typeof ChangeStockVendorFulfilledDTOSchema
>

export type ChangeStockCustomerFulfilledDTO = z.infer<
  typeof ChangeStockCustomerFulfilledDTOSchema
>

export type AddStockCustomerFulfilledDTO = z.infer<
  typeof AddStockCustomerFulfilledDTOSchema
>

export type AddTransactionFulfilledDTO = z.infer<
  typeof AddTransactionFulfilledDTOSchema
>

export type ChangeStockVendorCustomerFulfilledDTO = z.infer<
  typeof ChangeStockVendorCustomerFulfilledDTOSchema
>

export type AddPurchaseFulfillDTO = z.infer<typeof AddPurchaseFulfillDTOSchema>

export interface OrderStatusFulfilled {
  program_id: number
  order_id: number
  comment: string | null | undefined
  fulfilled_at: Date | string
  order_items: OrderItem[]
}

export interface OrderItem {
  id: number
  material_id: number
  order_stock_fulfill: OrderStockFulfill[]
}

export interface OrderStockFulfill {
  stock_id: number
  batch_id: number
  status: string | null
  fulfill_reason: string | null
  other_reason: string | null
  received_qty: number
}
