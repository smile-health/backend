import { z } from "zod"
import { OrderSchema } from "../order/order.schema.js"
import {
  WsEntities,
  WsMaterials,
  WsOrderReasons,
} from "@/common/infrastructure/database/types/db.js"
import { Selectable } from "kysely"

export type OrderRelocationEntityDTO =
  | {
      id: number
      name: string | null
    }
  | undefined

const preprocessToString = (value: unknown) =>
  typeof value === "number" ? String(value) : value

export const CreateOrderRelocationSchema = OrderSchema.omit({
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

  order_items: z.array(
    z.object({
      material_id: z.number().positive(),
      ordered_qty: z.number().positive(),
      order_reason_id: z.number().positive().nullish(),
      recommended_stock: z.number().nonnegative().nullish(),
      order_stock_status_id: z
        .union([
          z.literal(1),
          z.literal(2),
          z.literal(3),
          z.literal(4),
          z.null(),
        ])
        .nullable()
        .optional(),
      other_reason: z.preprocess(
        preprocessToString,
        z.string().min(1).max(255).nullish()
      ),
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
  order_comment: z.string().nullish(),
})

export type EntitySchema = Selectable<WsEntities>

/* REquest Body Type */
export type CreateOrderRelocationRequestSchema = z.infer<
  typeof CreateOrderRelocationSchema
>

export type ListEntityArraySchema = Selectable<WsEntities>[]

export type WSMaterialSchema = Selectable<WsMaterials>
export type WsOrderReasonSchema = Selectable<WsOrderReasons>

export type ReturnEntityLevel =
  | "province"
  | "regency"
  | "sub_district"
  | "unknown"

/* DTO Schema */
export const CreateOrderRelocationDTOSchema = OrderSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
})

/* DTO Type */
export type CreateOrderRelocationDTO = z.infer<
  typeof CreateOrderRelocationDTOSchema
>
