import {
  WsActivities,
  WsEntities,
  WsMaterials,
} from "@/common/infrastructure/database/types/db.js"
import { Selectable } from "kysely"
import { z } from "zod"
import { OrderItemStockSchema } from "../order-item-stock/order-item-stock.schema.js"
import { OrderSchema } from "../order/order.schema.js"

export const CreateOrderAllocationSchema = OrderSchema.omit({
  id: true,
  order_status_id: true,
  order_type_id: true,
  delivery_type_id: true,
  device_type: true,
  biofarma_chanqed: true,
  no_document: true,
  notes: true,
  no_po: true,
  total_order_items: true,
  created_by: true,
  updated_by: true,
  deleted_by: true,
  created_at: true,
  updated_at: true,
  deleted_at: true,
}).extend({
  activity_id: z.number().positive(),
  required_date: z.coerce
    .date()
    .refine((value) => value, { message: "validator.date" })
    .nullish()
    .optional(),
  estimated_date: z
    .union([z.date(), z.null(), z.undefined()])
    .optional()
    .refine(
      (value) => value instanceof Date || value === null || value === undefined,
      {
        message: "validator.date",
      }
    ),

  order_items: z.array(
    z.object({
      material_id: z.number().positive(),
      stocks: z.array(
        z.object({
          allocated_qty: z.number().positive(),
          activity_id: z.number().positive(),
          stock_id: z.number().positive(),
          order_stock_status_id: z
            .union([
              z.literal(1),
              z.literal(2),
              z.literal(3),
              z.literal(4),
              z.null(),
            ])
            .nullable(),
        })
      ),
    })
  ),
  order_comment: z.string().nullish(),
})

export const CheckStokSchema = z.array(
  z.object({
    activity_id: z.number().positive().nullish(),
    qty: z.number().positive().nullish(),
    name: z.string().min(1).max(255).nullish(),
    id: z.number().positive().nullish(),
    material_id: z.number().positive().nullish(),
    allocated_qty: z.number().positive().nullish(),
  })
)

/* DTO Schema */
export const CreateAllocationOrderItemStockDTOSchema =
  OrderItemStockSchema.omit({
    id: true,
    created_at: true,
    updated_at: true,
    order_reason_id: true,
  }).extend({
    stock_id: z.number().positive(),
    allocated_qty: z.number().positive(),
    ordered_qty: z.number().positive().nullish(),
    qty: z.number().positive().nullish(),
    confirmed_qty: z.number().positive().nullish(),
  })

/* Request Body Type */
export type CreateOrderAllocationRequest = z.infer<
  typeof CreateOrderAllocationSchema
>

export type CreateAllocationOrderItemStockDTO = z.infer<
  typeof CreateAllocationOrderItemStockDTOSchema
>

export type ListEntityArraySchema = Selectable<WsEntities>[]

export type WSMaterialSchema = Selectable<WsMaterials>

export type ListCheckStockSchema = z.infer<typeof CheckStokSchema>

export type WSActivitySchema = Selectable<WsActivities>
