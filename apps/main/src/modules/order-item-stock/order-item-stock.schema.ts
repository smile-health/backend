import z from "zod"
import { IdParamsSchema } from "@smile/lib/types/param.js"

const preprocessToString = (value: unknown) =>
  typeof value === "number" ? String(value) : value

/* Base Schema */
export const OrderItemStockSchema = z.object({
  id: z.number().positive(),
  order_id: z.number().positive(),
  order_item_kfa_id: z.number().positive().nullish(),
  material_id: z.number().positive(),
  stock_id: z.number().positive().nullish(),
  order_stock_status_id: z.number().nullish(),
  qty: z.number().positive().optional(),
  ordered_qty: z.number().nonnegative(),
  allocated_qty: z.number().positive().nullish(),
  confirmed_qty: z.number().positive().nullish(),
  received_qty: z.number().positive().nullish(),
  recommended_stock: z.number().nonnegative().nullish(),
  order_reason_id: z.number().positive().nullish(),
  fulfill_reason: z.number().positive().nullish(),
  fulfill_status: z.number().positive().nullish(),
  qrcode: z.preprocess(
    preprocessToString,
    z.string().min(1).max(255).nullish()
  ),
  created_by: z.number().positive(),
  updated_by: z.number().positive(),
  deleted_by: z.number().nullish(),
  created_at: z.date(),
  updated_at: z.date(),
  deleted_at: z.date().nullish(),
})

/* DTO Schema */
export const CreateOrderItemStockDTOSchema = OrderItemStockSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
}).extend({
  other_reason: z.preprocess(
    preprocessToString,
    z.string().min(1).max(255).nullish()
  ),
})

export const AddOrderItemStockDTOSchema = OrderItemStockSchema.pick({
  order_item_kfa_id: true,
  material_id: true,
  recommended_stock: true,
  order_reason_id: true,
  order_id: true,
  qty: true,
  created_by: true,
  updated_by: true,
  created_at: true,
  updated_at: true,
}).extend({
  other_reason: z.string().nullish(),
  ordered_qty: z.number().positive(),
})

export const AddOtherReasonDTOSchema = z.object({
  source_id: z.number().positive(),
  source_type: z.string(),
  content: z.string(),
  created_at: z.date(),
  updated_at: z.date(),
})

export const EditOrderItemStockDTOSchema = OrderItemStockSchema.pick({
  id: true,
  ordered_qty: true,
  recommended_stock: true,
  order_reason_id: true,
  qty: true,
  updated_by: true,
  updated_at: true,
}).extend({
  other_reason: z.string().nullish(),
})

export const EditOtherReasonDTOSchema = z.object({
  content: z.string(),
  updated_at: z.date(),
})

/* Request Body Schema */
export const AddOrderItemStockRequestSchema = z.object({
  order_items: z.array(
    OrderItemStockSchema.pick({
      order_item_kfa_id: true,
      material_id: true,
      recommended_stock: true,
      order_reason_id: true,
    }).extend({
      other_reason: z.string().nullish(),
      ordered_qty: z.number().positive(),
      children: z
        .array(
          z.object({
            material_id: z.number().positive(),
            ordered_qty: z.number().positive(),
          })
        )
        .optional(),
    })
  ),
})

export const EditOrderItemStockRequestSchema = z.object({
  order_items: z.array(
    OrderItemStockSchema.pick({
      id: true,
      ordered_qty: true,
      recommended_stock: true,
      order_reason_id: true,
    }).extend({
      other_reason: z.string().nullish(),
      children: z
        .array(
          z.object({
            id: z.number().positive(),
            ordered_qty: z.number().positive(),
          })
        )
        .optional(),
    })
  ),
})

export const EditOrderDTOSchema = z.object({
  total_order_items: z.number().positive(),
})

/* Path Params Schema */
export const GetDetailOrderSchema = IdParamsSchema

/* DTO Type */
export type CreateOrderItemStockDTO = z.infer<
  typeof CreateOrderItemStockDTOSchema
>

export type AddOrderItemStockDTO = z.infer<typeof AddOrderItemStockDTOSchema>

export type AddOtherReasonDTO = z.infer<typeof AddOtherReasonDTOSchema>

export type EditOrderItemStockDTO = z.infer<typeof EditOrderItemStockDTOSchema>

export type EditOtherReasonDTO = z.infer<typeof EditOtherReasonDTOSchema>

/* Request Body Type */
export type AddOrderItemStockRequest = z.infer<
  typeof AddOrderItemStockRequestSchema
>

export type EditOrderItemStockRequest = z.infer<
  typeof EditOrderItemStockRequestSchema
>

export type EditOrderDTO = z.infer<typeof EditOrderDTOSchema>
