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

/**
 *
 * month_period and year_period are required to filter stock opname data
 */
export const GetStockOpnamesQueries = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    paginate: z.coerce.number().int().min(1).default(10),
    month_period: z.coerce.number().int().min(1).max(12),
    year_period: z.coerce.number().int(),
    entity_id: z.coerce.number().int().optional(),
    entity_tag_id: z.coerce.number().int().optional(),
    province_id: z.coerce.number().int().optional(),
    regency_id: z.coerce.number().int().optional(),
    id_satu_sehat: z.coerce.number().int().optional(),
    created_from: optionalDateSchema,
    created_to: optionalDateSchema,
  })
  .superRefine((val, c) => {
    // const programId = c.req.header("x-program-id")
    // console.log("Program ID:", programId)
    if (val.created_from && val.created_to) {
      if (val.created_from > val.created_to) {
        c.addIssue({
          code: z.ZodIssueCode.custom,
          message: "validator.end_date_before_start_date",
          path: ["created_to"],
        })
      }
    }

    const validPaginations = [10, 25, 50, 100]
    if (!validPaginations.includes(val.paginate)) {
      c.addIssue({
        code: z.ZodIssueCode.custom,
        message: `validator.pagination_must_be_in_${validPaginations.join("_or_")}`,
        path: ["paginate"],
      })
    }
  })

export const GetTransactionQueries = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    paginate: z.coerce.number().int().min(1).default(10),
    material_id: z.coerce.number().int().optional(),
    entity_id: z.coerce.number().int().optional(),
    entity_tag_id: z.coerce.number().int().optional(),
    province_id: z.coerce.number().int().optional(),
    regency_id: z.coerce.number().int().optional(),
    start_date: optionalDateSchema,
    end_date: optionalDateSchema,
    kfa_code: z.coerce.string().optional(),
    id_satu_sehat: z.coerce.number().int().optional(),
  })
  .superRefine((val, c) => {
    if (val.start_date && val.end_date) {
      if (val.start_date > val.end_date) {
        c.addIssue({
          code: z.ZodIssueCode.custom,
          message: "validator.end_date_before_start_date",
          path: ["end_date"],
        })
      }
    }

    const validPaginations = [10, 25, 50, 100]
    if (!validPaginations.includes(val.paginate)) {
      c.addIssue({
        code: z.ZodIssueCode.custom,
        message: `validator.pagination_must_be_in_${validPaginations.join("_or_")}`,
        path: ["paginate"],
      })
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
