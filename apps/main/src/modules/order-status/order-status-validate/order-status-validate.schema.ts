import { IdParamsSchema } from "@smile/lib/types/param.js"
import z, { optional } from "zod"

/* Base Schema */
export const OrderStatusValidateSchema = z.object({
  id: z.number().positive(),
  order_id: z.number().positive(),
  order_status_id: z.number().positive(),
  user_id: z.number().positive(),
  qty: z.number().nonnegative().optional(),
  validated_qty: z.number().nonnegative().optional(),
  validated_by: z.number().positive(),
  created_by: z.number().positive(),
  updated_by: z.number().positive(),
  deleted_by: z.number().nullish(),
  validated_at: z.date(),
  created_at: z.date(),
  updated_at: z.date(),
  deleted_at: z.date().nullish(),
  no_document: z.string().min(1),
})

/* Request Body Schema */
export const ChangeOrderStatusValidateRequestSchema = z.object({
  order_items: z.array(
    OrderStatusValidateSchema.pick({
      id: true,
      validated_qty: true,
    }).extend({
      children: z
        .array(
          z.object({
            id: z.number().positive(),
            validated_qty: z.number().nonnegative(),
          })
        )
        .optional(),
    })
  ),
  letter_number: z.string().min(1),
  comment: z.string().nullish(),
})

export const ChangeOrderItemStockValidateRequestSchema =
  OrderStatusValidateSchema.pick({
    id: true,
    validated_qty: true,
    updated_by: true,
    updated_at: true,
  })

/* DTO Schema */
export const ChangeOrderItemStockValidateDTOSchema =
  ChangeOrderItemStockValidateRequestSchema.omit({
    id: true,
  })

export const ChangeOrderStatusValidateDTOSchema =
  OrderStatusValidateSchema.pick({
    no_document: true,
    order_status_id: true,
    updated_by: true,
    updated_at: true,
  })

export const AddOrderHistoryValidateDTOSchema = OrderStatusValidateSchema.pick({
  order_id: true,
  order_status_id: true,
  created_by: true,
  updated_by: true,
  created_at: true,
  updated_at: true,
})

export const AddOrderCommentValidateDTOSchema = OrderStatusValidateSchema.pick({
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

export const UpdateOrderAuditValidateDTOSchema = OrderStatusValidateSchema.pick(
  {
    validated_at: true,
    updated_at: true,
    validated_by: true,
    updated_by: true,
  }
)

/* Path Params Schema */
export const GetDetailOrderValidateSchema = IdParamsSchema

/* Request Body Type */
export type ChangeOrderStatusValidateRequest = z.infer<
  typeof ChangeOrderStatusValidateRequestSchema
>

export type ChangeOrderItemStockValidateRequest = z.infer<
  typeof ChangeOrderItemStockValidateRequestSchema
>

/* DTO Type */
export type ChangeOrderItemStockValidateDTO = z.infer<
  typeof ChangeOrderItemStockValidateDTOSchema
>

export type ChangeOrderStatusValidateDTO = z.infer<
  typeof ChangeOrderStatusValidateDTOSchema
>

export type AddOrderHistoryValidateDTO = z.infer<
  typeof AddOrderHistoryValidateDTOSchema
>

export type AddOrderCommentValidateDTO = z.infer<
  typeof AddOrderCommentValidateDTOSchema
>

export type UpdateOrderAuditValidateDTO = z.infer<
  typeof UpdateOrderAuditValidateDTOSchema
>
