import { z } from "zod"

import {
  WsActivities,
  WsEntities,
  WsMaterials,
} from "@/common/infrastructure/database/types/db.js"
import { Selectable } from "kysely"

const AddressSchema = z.object({
  type: z.string().nullish(),
  kode: z.string(),
  nama: z.string().nullish(),
  alamat: z.string().nullish(),
  kodepos: z.string().nullish(),
  provinsi: z.string().nullish(),
  provinsi_code: z.string().nullish(),
  kabkota: z.string().nullish(),
  kabkota_code: z.string().nullish(),
  kecamatan: z.string().nullish(),
  kecamatan_code: z.string().nullish(),
  kelurahan: z.string().nullish(),
  kelurahan_code: z.string().nullish(),
})

const OrderItemSchema = z.object({
  lot_no: z.string(),
  tgl_kadaluarsa: z.string(),
  tgl_produksi: z.string().nullish(),
  product_name: z.string().nullish(),
  kfa_code: z.string(),
  qty: z.number(),
  unit: z.string(),
  unit_price: z.number(),
  total_price: z.number(),
  note: z.string().nullish(),
})

/* Request Body Schema */
export const OrderDinRequestSchema = z.object({
  key: z.string().uuid(),
  doc_num: z.string(),
  ref_num: z.string(),
  code: z.string().nullish(),
  line: z.string().nullish(),
  line_ref: z.string().nullish(),
  carrier_ref: z.boolean().default(false),
  penanggung_jawab: z.string().nullish(),
  carrier: z.string().nullish(),
  sumber_dana: z.string().nullish(),
  biaya_transport: z.number().nullish(),
  total_transaksi: z.number().nullish(),
  status: z.string().nullish().default("ship"),
  program: z.array(z.string()).min(1),
  pengirim: AddressSchema,
  penerima: AddressSchema,
  note: z
    .string()
    .nullable() // allows null
    .optional() // allows undefined
    .or(z.literal(false)) // allows literal false
    .transform((val) => {
      if (val === false || val === null || val === undefined) return false
      return String(val)
    }),
  created_by: z.string().nullish(),
  updated_by: z.string().nullish(),
  // created_at: z.string().datetime(),
  // updated_at: z.string().datetime(),
  data: z.array(OrderItemSchema),
})

export const CreateOrderResponseSchema = z
  .object({
    success: z.boolean(),
    code: z.number().int(),
    message: z.string(),
  })
  .describe("Create Order Response")

export const LoginRequestSchema = z.object({
  username: z.string().openapi({ example: "dto_din" }),
  password: z.string().openapi({ example: "" }),
})

/* Request Body Type */
export type CreateOrderDinRequest = z.infer<typeof OrderDinRequestSchema>
export type AddressEntityRequest = z.infer<typeof AddressSchema>
export type OrderItemEntityRequest = z.infer<typeof OrderItemSchema>

export type WSMaterialSchema = Selectable<WsMaterials>
export type WSEntitiesSchema = Selectable<WsEntities>
export type WSActivitySchema = Selectable<WsActivities>
