import { z } from "zod"

const optionalDateSchema = z
  .string()
  .date()
  .or(z.literal(""))
  .nullish()
  .transform((date) => (date ? new Date(date) : null))

const StockItem = z.object({
  activity_id: z.number().int(),
  stock_id: z.number().int().nullish(),
  batch_code: z.string().nullish(),
  expired_date: optionalDateSchema,
  recorded_qty: z.number().default(0),
  in_transit_qty: z.number().default(0),
  actual_qty: z.number().default(0),
})

const StockOpnameBatchItem = z.object({
  material_id: z.number().int(),
  stocks: z.array(StockItem).min(1),
})

export const CreateStockOpnameRequest = z.object({
  period_id: z.number().int(),
  entity_id: z.number().int(),
  is_within_period: z.number().int().optional(),
  items: z.array(StockOpnameBatchItem).min(1),
})

export const GetStockOpnamesQueries = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    paginate: z.coerce.number().int().min(1).default(10),
    offset: z.coerce.number().int().min(0).default(0),
    period_id: z.coerce.number().int().optional(),
    entity_id: z.coerce.number().int().optional(),
    material_id: z.coerce.number().int().optional(),
    parent_material_id: z.coerce.number().int().optional(),
    material_type_id: z.coerce.number().int().optional(),
    activity_id: z.coerce.number().int().optional(),
    stock_id: z.coerce.number().int().optional(),
    batch_code: z.string().optional(),
    entity_tag_id: z.coerce.number().int().optional(),
    expired_start_date: optionalDateSchema,
    expired_end_date: optionalDateSchema,
    province_id: z.coerce.number().int().optional(),
    regency_id: z.coerce.number().int().optional(),
    created_from: optionalDateSchema,
    created_to: optionalDateSchema,
    only_have_qty: z.coerce.number().int().default(1),
    is_within_period: z.coerce.number().int().optional(),
  })
  .superRefine((val, c) => {
    if (val.expired_start_date && val.expired_end_date) {
      if (val.expired_start_date > val.expired_end_date) {
        c.addIssue({
          code: z.ZodIssueCode.custom,
          message: "validator.end_date_before_start_date",
          path: ["expired_end_date"],
        })
      }
    }

    if (val.created_from && val.created_to) {
      if (val.created_from > val.created_to) {
        c.addIssue({
          code: z.ZodIssueCode.custom,
          message: "validator.end_date_before_start_date",
          path: ["created_to"],
        })
      }
    }
  })

export const StockOpnameResponse = z.object({
  id: z.number(),
  period_id: z.number().int(),
  entity_id: z.number().int(),
  material_id: z.number().int().nullable(),
  parent_material_id: z.number().int().nullable(),
  activity_id: z.number().int().nullable(),
  stock_id: z.number().int().nullable(),
  batch_code: z.string().nullable(),
  expired_date: z.date().nullable(),
  recorded_qty: z.number(),
  in_transit_qty: z.number(),
  actual_qty: z.number(),
  is_within_period: z.number().int().default(0),
  created_at: z.date(),
  updated_at: z.date(),
})

export type GetStockOpnameParamsDTO = z.infer<typeof GetStockOpnamesQueries>
