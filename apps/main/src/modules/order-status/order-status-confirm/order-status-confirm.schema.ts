import z from "zod"
import { IdParamsSchema } from "@smile-health/lib/types/param.js"

/* Base Schema */
export const OrderStatusConfirmSchema = z.object({
  id: z.number().positive(),
  order_id: z.number().positive(),
  order_status_id: z.number().positive(),
  user_id: z.number().positive(),
  qty: z.number().positive().optional(),
  confirmed_qty: z.number().nonnegative(),
  confirmed_by: z.number().positive(),
  created_by: z.number().positive(),
  updated_by: z.number().positive(),
  deleted_by: z.number().nullish(),
  confirmed_at: z.date(),
  created_at: z.date(),
  updated_at: z.date(),
  deleted_at: z.date().nullish(),
})

/* Request Body Schema */
export const ChangeOrderStatusConfirmRequestSchema = z.object({
  order_items: z.array(
    OrderStatusConfirmSchema.pick({
      id: true,
      confirmed_qty: true,
    }).extend({
      children: z
        .array(
          z.object({
            id: z.number().positive(),
            confirmed_qty: z.number().nonnegative(),
          })
        )
        .optional(),
    })
  ),
  comment: z.string().nullish(),
})

export const ChangeOrderItemStockConfirmRequestSchema =
  OrderStatusConfirmSchema.pick({
    id: true,
    confirmed_qty: true,
    qty: true,
    updated_by: true,
    updated_at: true,
  })

/* DTO Schema */
export const ChangeOrderItemStockConfirmDTOSchema =
  ChangeOrderItemStockConfirmRequestSchema.omit({
    id: true,
  })

export const ChangeOrderStatusConfirmDTOSchema = OrderStatusConfirmSchema.pick({
  order_status_id: true,
  updated_by: true,
  updated_at: true,
})

export const AddOrderHistoryConfirmDTOSchema = OrderStatusConfirmSchema.pick({
  order_id: true,
  order_status_id: true,
  created_by: true,
  updated_by: true,
  created_at: true,
  updated_at: true,
})

export const AddOrderCommentConfirmDTOSchema = OrderStatusConfirmSchema.pick({
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

export const UpdateOrderAuditConfrimDTOSchema = OrderStatusConfirmSchema.pick({
  confirmed_at: true,
  updated_at: true,
  confirmed_by: true,
  updated_by: true,
})

/* Path Params Schema */
export const GetDetailOrderSchema = IdParamsSchema

/* Request Body Type */
export type ChangeOrderStatusConfirmRequest = z.infer<
  typeof ChangeOrderStatusConfirmRequestSchema
>

export type ChangeOrderItemStockConfirmRequest = z.infer<
  typeof ChangeOrderItemStockConfirmRequestSchema
>

/* DTO Type */
export type ChangeOrderItemStockConfirmDTO = z.infer<
  typeof ChangeOrderItemStockConfirmDTOSchema
>

export type ChangeOrderStatusConfirmDTO = z.infer<
  typeof ChangeOrderStatusConfirmDTOSchema
>

export type AddOrderHistoryConfirmDTO = z.infer<
  typeof AddOrderHistoryConfirmDTOSchema
>

export type AddOrderCommentConfirmDTO = z.infer<
  typeof AddOrderCommentConfirmDTOSchema
>

export type UpdateOrderAuditConfrimDTO = z.infer<
  typeof UpdateOrderAuditConfrimDTOSchema
>
