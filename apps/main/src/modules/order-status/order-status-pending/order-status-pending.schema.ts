import z from "zod"
import { IdParamsSchema } from "@smile/lib/types/param.js"

/* Base Schema */
export const OrderStatusPendingSchema = z.object({
  order_id: z.number().positive(),
  order_status_id: z.number().positive(),
  user_id: z.number().positive(),
  qty: z.number().positive().nullish(),
  confirmed_qty: z.number().nullish(),
  created_by: z.number().positive(),
  updated_by: z.number().positive(),
  deleted_by: z.number().nullish(),
  created_at: z.date(),
  updated_at: z.date(),
  deleted_at: z.date().nullish(),
})

/* DTO Schema */
export const ChangeOrderItemStockPendingDTOSchema =
  OrderStatusPendingSchema.pick({
    qty: true,
    confirmed_qty: true,
    updated_by: true,
    updated_at: true,
  })

export const ChangeOrderStatusPendingDTOSchema = OrderStatusPendingSchema.pick({
  order_status_id: true,
  updated_by: true,
  updated_at: true,
})

export const AddOrderHistoryPendingDTOSchema = OrderStatusPendingSchema.pick({
  order_id: true,
  order_status_id: true,
  created_by: true,
  updated_by: true,
  created_at: true,
  updated_at: true,
})

export const AddOrderCommentPendingDTOSchema = OrderStatusPendingSchema.pick({
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

/* Path Params Schema */
export const GetDetailOrderSchema = IdParamsSchema

/* Request Body Type */
export type ChangeOrderStatusPendingRequest = z.infer<
  typeof ChangeOrderStatusPendingRequestSchema
>

export type ChangeOrderItemStockPendingRequest = z.infer<
  typeof ChangeOrderItemStockPendingRequestSchema
>

/* DTO Type */
export type ChangeOrderItemStockPendingDTO = z.infer<
  typeof ChangeOrderItemStockPendingDTOSchema
>

export type ChangeOrderStatusPendingDTO = z.infer<
  typeof ChangeOrderStatusPendingDTOSchema
>

export type AddOrderHistoryPendingDTO = z.infer<
  typeof AddOrderHistoryPendingDTOSchema
>

export type AddOrderCommentPendingDTO = z.infer<
  typeof AddOrderCommentPendingDTOSchema
>
