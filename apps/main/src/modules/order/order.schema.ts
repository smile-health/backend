import { PaginationQueriesSchema } from "@smile/lib/types/paginate.js"
import { IdParamsSchema } from "@smile/lib/types/param.js"
import z from "zod"

export type ListUserOrderDTO = {
  id: number
  firstname: string | null
  lastname: string | null
}

export type LocationUserOrderDTO =
  | {
      province_id: string | null
      regency_id: string | null
      sub_district_id: string | null
      village_id: string | null
    }
  | undefined

const preprocessToString = (value: unknown) =>
  typeof value === "number" ? String(value) : value

/* Base Schema */
export const OrderSchema = z.object({
  id: z.number().positive(),
  customer_id: z.number().positive(),
  vendor_id: z.number().positive(),
  order_status_id: z.number().positive(),
  order_type_id: z.number().positive().nullish(),
  activity_id: z.number().positive(),
  delivery_type_id: z.number().positive().nullish(),
  purchase_ref: z.preprocess(
    preprocessToString,
    z.string().min(1).max(255).nullish()
  ),
  sales_ref: z.preprocess(
    preprocessToString,
    z.string().min(1).max(255).nullish()
  ),
  device_type: z.number().positive().nullish(),
  is_allocated: z.number().min(0).max(1).default(1),
  is_manual: z.number().min(0).max(1).default(0).nullish(),
  taken_by_customer: z.number().min(0).max(1).default(0),
  biofarma_chanqed: z.number().min(0).max(1).nullish(),
  no_document: z.preprocess(
    preprocessToString,
    z.string().min(1).max(255).nullish()
  ),
  notes: z.preprocess(preprocessToString, z.string().min(1).max(255).nullish()),
  no_po: z.preprocess(preprocessToString, z.string().min(1).max(255).nullish()),
  total_order_items: z.number().positive().nullish(),
  metadata: z.any().optional(),
  created_by: z.number().positive(),
  updated_by: z.number().positive(),
  deleted_by: z.number().positive().nullish(),
  created_at: z.date(),
  updated_at: z.date(),
  deleted_at: z.date().nullish(),
})

const ListOrderSchema = {
  type: z
    .enum(["1", "2", "3", "4", "7"], { message: "INVALID REQUEST TYPE" })
    .transform((val) => Number(val))
    .optional(),
  activity_id: z
    .preprocess(preprocessToString, z.string().optional())
    .optional(),
  service_type: z.preprocess(preprocessToString, z.string().optional()),
  status: z
    .enum(["1", "2", "3", "4", "5", "6", "8"], {
      message: "INVALID REQUEST STATUS",
    })
    .transform((val) => Number(val))
    .optional(),
  order_number: z
    .string()
    .refine(
      (val) =>
        val
          .split(",")
          .filter((item) => item !== "")
          .every((num) => !isNaN(Number(num))),
      {
        message: "INVALID_ORDER_NUMBER_PARAM",
      }
    )
    .transform((val) => val.split(",").filter((item) => item !== ""))
    .optional(),
  from_date: z.string().date().optional(),
  to_date: z.string().date().optional(),
  purpose: z
    .enum(["sales", "purchase"], { message: "INVALID REQUEST PURPOSE" })
    .optional(),
  entity_tag_id: z
    .string()
    .transform((val) => Number(val))
    .refine((v) => !isNaN(v!), { message: "invalid entity_tag_id" })
    .optional(),
  entity_id: z
    .string()
    .transform((val) => Number(val))
    .refine((v) => !isNaN(v!), { message: "invalid entity_id" })
    .optional(),
  vendor_id: z
    .string()
    .transform((val) => Number(val))
    .refine((v) => !isNaN(v!), { message: "invalid vendor_id" })
    .optional(),
  customer_id: z
    .string()
    .transform((val) => Number(val))
    .refine((v) => !isNaN(v!), { message: "invalid customer_id" })
    .optional(),
  entity_province_id: z
    .string()
    .transform((val) => Number(val))
    .refine((v) => !isNaN(v!), { message: "invalid entity_province_id" })
    .optional(),
  entity_city_id: z
    .string()
    .transform((val) => Number(val))
    .refine((v) => !isNaN(v!), { message: "invalid entity_city_id" })
    .optional(),
  entity_puskesmas_id: z
    .string()
    .transform((val) => Number(val))
    .refine((v) => !isNaN(v!), { message: "invalid entity_puskesmas_id" })
    .optional(),
  status_ids: z.preprocess(
    (val) => {
      if (typeof val === "string") {
        return val.split(",").map((str) => Number(str))
      }
      return undefined
    },
    z.array(z.number().refine((n) => !isNaN(n))).optional()
  ),
  type_ids: z.preprocess(
    (val) => {
      if (typeof val === "string") {
        return val.split(",").map((str) => Number(str))
      }
      return undefined
    },
    z.array(z.number().refine((n) => !isNaN(n))).optional()
  ),
  integration: z.string().optional(),
  province_id: z
    .string()
    .transform((val) => Number(val))
    .refine((v) => !isNaN(v!), { message: "invalid province_id" })
    .optional(),
  regency_id: z
    .string()
    .transform((val) => Number(val))
    .refine((v) => !isNaN(v!), { message: "invalid regency_id" })
    .optional(),
  is_from_ticketing: z
    .enum(["0", "1"], {
      message: "INVALID REQUEST IS FROM TICKETING",
    })
    .transform((val) => Number(val))
    .optional(),
}

/* Query Params Schema */
export const GetListOrderSchema =
  PaginationQueriesSchema.extend(ListOrderSchema)

export const GetStatusCountSchema = z.object({
  type: z
    .enum(["1", "2", "3", "4", "5", "6", "7", "8"], {
      message: "INVALID REQUEST TYPE",
    })
    .transform((val) => Number(val))
    .optional(),
  purpose: z.enum(["sales", "purchase"], {
    message: "INVALID REQUEST PURPOSE",
  }),
  order_id: z
    .string()
    .transform((val) => Number(val))
    .refine((v) => !isNaN(v!), { message: "invalid order_id" })
    .optional(),
  activity_id: z
    .string()
    .transform((val) => Number(val))
    .refine((v) => !isNaN(v!), { message: "invalid activity_id" })
    .optional(),
  vendor_id: z
    .string()
    .transform((val) => Number(val))
    .refine((v) => !isNaN(v!), { message: "invalid vendor_id" })
    .optional(),
  customer_id: z
    .string()
    .transform((val) => Number(val))
    .refine((v) => !isNaN(v!), { message: "invalid customer_id" })
    .optional(),
  from_date: z.string().date().optional(),
  to_date: z.string().date().optional(),
  integration: z.string().optional(),
})

/* Request Body Schema */
export const CreateOrderRequestSchema = OrderSchema.omit({
  id: true,
  order_status_id: true,
  created_at: true,
  updated_at: true,
  deleted_at: true,
  created_by: true,
  updated_by: true,
  deleted_by: true,
}).extend({
  required_date: z.coerce.date().nullish(),
  order_comment: z.preprocess(
    preprocessToString,
    z.string().min(1).max(255).nullish()
  ),
  order_items: z
    .array(
      z.object({
        ordered_qty: z.number().positive(),
        recommended_stock: z.number().nonnegative().nullish(),
        material_id: z.number().positive(),
        order_reason_id: z.number().positive().nullish(),
        order_stock_status_id: z.number().positive().nullish(),
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
        metadata: z.any().optional(),
      })
    )
    .min(1),
})

/* DTO Schema */
export const CreateOrderDTOSchema = OrderSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
})

/* Path Params Schema */
export const GetDetailOrderSchema = IdParamsSchema

/* Query Params Type */
export type GetOrderQueries = z.infer<typeof GetListOrderSchema>
export type GetStatusCountQueries = z.infer<typeof GetStatusCountSchema>

/* Request Body Type */
export type CreateOrderRequest = z.infer<typeof CreateOrderRequestSchema>

/* DTO Type */
export type CreateOrderDTO = z.infer<typeof CreateOrderDTOSchema>

export type RowType = string | number | Date | null
