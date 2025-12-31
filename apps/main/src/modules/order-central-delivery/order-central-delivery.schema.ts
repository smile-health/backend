import {
  WsBatches,
  WsBudgetSources,
  WsManufactures,
  WsMaterials,
  WsPurchases,
  WsStocks,
} from "@/common/infrastructure/database/types/db.js"
import { conditionsMessage } from "@smile/lib/zod.js"
import { Insertable, Selectable } from "kysely"
import { z } from "zod"
import { CreateOrderRequestSchema } from "../order/order.schema.js"

const positiveNumberZod = z.coerce.number().positive()
const dateZod = z.coerce
  .string()
  .date()
  .nullish()
  .superRefine((val, cfx) => {
    if (val) {
      conditionsMessage(cfx, "validator.date", isNaN(new Date(val).getTime()))
    }
  })
  .transform((str) => {
    if (str) {
      return new Date(str)
    }
  })

export const CreateSchema = CreateOrderRequestSchema.pick({
  customer_id: true,
  vendor_id: true,
  activity_id: true,
  order_comment: true,
  is_allocated: true,
  is_manual: true,
  metadata: true,
}).extend({
  required_date: CreateOrderRequestSchema.shape.required_date.nullish(),
  order_items: z
    .array(
      z.object({
        material_id: positiveNumberZod,
        is_managed_in_batch: z.boolean(),
        metadata: z.any(),
        stocks: z
          .array(
            z.object({
              expired_date: dateZod,
              manufacture_name: z.string().min(1).max(255).nullish(),
              production_date: dateZod,
              ordered_qty: positiveNumberZod,
              batch_code: z.coerce.string().max(255).nullish(), // batch id ( input fe )
              budget_year: positiveNumberZod.nullish(),
              budget_source_id: positiveNumberZod.nullish(),
              total_price: positiveNumberZod.nullish(),
            })
          )
          .min(1),
      })
    )
    .min(1),
  po_number: z.coerce.string().max(255).nullish(),
  delivery_type_id: positiveNumberZod, // service_type ( buffer pusat, reguler )
  do_number: z.coerce.string().max(255).nullish(),
  materials: z.array(z.object({})).optional(),
})

export type CreateRequest = z.infer<typeof CreateSchema> & {
  batchCodeMapping: batchCodeMapping[]
}

export type CreateOrderStockPurchase = Insertable<WsPurchases>
export type CreateBatch = Insertable<WsBatches>
export type CreateStock = Insertable<WsStocks>
export type WsManufactureMaterialDTO = Selectable<
  Pick<WsManufactures, "id" | "name" | "description" | "address"> & {
    material_id: number
  }
>
export type WsMaterialDTO = Selectable<WsMaterials>
export type WsBudgetSourcesDTO = Selectable<WsBudgetSources>
export type batchCodeMapping = {
  [key: string]: number
}
