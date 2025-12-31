import z from "zod"
import { DateSchema } from "@smile/lib/types/param.js"

/* Base Schema */
export const OrderReturnSchema = z.object({
  order_id: z.number().positive(),
  customer_id: z.number().positive(),
  vendor_id: z.number().positive(),
  order_status_id: z.number().positive(),
  order_type_id: z.number().positive(),
  activity_id: z.number().positive(),
  device_type: z.number().positive(),
  is_allocated: z.number().optional(),
  material_id: z.number().positive(),
  stock_id: z.number().positive(),
  order_stock_status_id: z.number().positive().nullish(),
  order_item_kfa_id: z.number().positive(),
  allocated_qty: z.number().positive(),
  required_date: DateSchema.nullish(),
  confirmed_at: z.date(),
  confirmed_by: z.number().positive(),
  allocated_at: z.date(),
  allocated_by: z.number().positive(),
  user_id: z.number().positive(),
  order_comment: z.string().nullish(),
  total_order_items: z.number().positive(),
  created_by: z.number().positive(),
  updated_by: z.number().positive(),
  deleted_by: z.number().nullish(),
  created_at: z.date(),
  updated_at: z.date(),
  deleted_at: z.date().nullish(),
})

/* Request Body Schema */
const OrderRequestSchema = OrderReturnSchema.pick({
  customer_id: true,
  vendor_id: true,
  activity_id: true,
  required_date: true,
  order_comment: true,
  is_allocated: true,
})

const OrderItemStockRequestSchema = z.object({
  order_items: z.array(
    OrderReturnSchema.pick({
      material_id: true,
    }).extend({
      stocks: z.array(
        OrderReturnSchema.pick({
          order_stock_status_id: true,
          stock_id: true,
          allocated_qty: true,
        })
      ),
    })
  ),
})

export const OrderReturnRequestSchema = OrderRequestSchema.merge(
  OrderItemStockRequestSchema
)

/* DTO Schema */
export const AddOrderReturnDTOSchema = OrderReturnSchema.pick({
  customer_id: true,
  vendor_id: true,
  order_status_id: true,
  order_type_id: true,
  activity_id: true,
  device_type: true,
  is_allocated: true,
  total_order_items: true,
  created_at: true,
  updated_at: true,
  created_by: true,
  updated_by: true,
})

export const AddOrderItemStockReturnDTOSchema = OrderReturnSchema.pick({
  order_id: true,
  material_id: true,
  stock_id: true,
  order_stock_status_id: true,
  allocated_qty: true,
  created_at: true,
  updated_at: true,
  created_by: true,
  updated_by: true,
})

export const AddOrderHistoryReturnDTOSchema = OrderReturnSchema.pick({
  order_id: true,
  order_status_id: true,
  created_by: true,
  updated_by: true,
  created_at: true,
  updated_at: true,
})

export const AddOrderAuditReturnDTOSchema = OrderReturnSchema.pick({
  order_id: true,
  required_date: true,
  confirmed_at: true,
  allocated_at: true,
  created_at: true,
  updated_at: true,
  confirmed_by: true,
  allocated_by: true,
  created_by: true,
  updated_by: true,
})

export const AddOrderCommentReturnDTOSchema = OrderReturnSchema.pick({
  order_id: true,
  user_id: true,
  order_status_id: true,
  created_by: true,
  updated_by: true,
  created_at: true,
  updated_at: true,
}).extend({
  comment: z.string().nullish(),
})

export const ChangeStockReturnDTOSchema = OrderReturnSchema.pick({
  allocated_qty: true,
  updated_by: true,
  updated_at: true,
})

/* Request Body Type */
export type OrderReturnRequest = z.infer<typeof OrderReturnRequestSchema>

/* DTO Type */
export type AddOrderReturnDTO = z.infer<typeof AddOrderReturnDTOSchema>

export type AddOrderHistoryReturnDTO = z.infer<
  typeof AddOrderHistoryReturnDTOSchema
>

export type AddOrderItemStockReturnDTO = z.infer<
  typeof AddOrderItemStockReturnDTOSchema
>

export type AddOrderAuditReturnDTO = z.infer<
  typeof AddOrderAuditReturnDTOSchema
>

export type AddOrderCommentReturnDTO = z.infer<
  typeof AddOrderCommentReturnDTOSchema
>

export type ChangeStockReturnDTO = z.infer<typeof ChangeStockReturnDTOSchema>
