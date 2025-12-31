import { z } from "zod"

const optionalDateSchema = z
  .string()
  .date()
  .optional()
  .transform((date) => (date ? new Date(date) : null))

export const CreateStockOpnamePeriodRequest = z
  .object({
    start_date: z.string().date(),
    end_date: z.string().date(),
    month_period: z.number().int().min(1).max(12),
    year_period: z.number().int().min(2000),
    status: z.number().int().optional(),
  })
  .superRefine((val, c) => {
    if (new Date(val.start_date) > new Date(val.end_date)) {
      c.addIssue({
        code: z.ZodIssueCode.custom,
        message: "validator.end_date_before_start_date",
        path: ["end_date"],
      })
    }
  })

export const UpdateStockOpnamePeriodRequest = z
  .object({
    start_date: z.string().date(),
    end_date: z.string().date(),
    month_period: z.number().int().min(1).max(12),
    year_period: z.number().int().min(2000),
    status: z.number().int().optional(),
  })
  .superRefine((val, c) => {
    if (new Date(val.start_date) > new Date(val.end_date)) {
      c.addIssue({
        code: z.ZodIssueCode.custom,
        message: "validator.end_date_before_start_date",
        path: ["end_date"],
      })
    }
  })

export const UpdateStockOpnamePeriodStatusRequest = z.object({
  status: z.number().int(),
})

export const GetStockOpnamePeriodsQueries = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    paginate: z.coerce.number().int().min(1).optional(),
    offset: z.coerce.number().int().min(0).default(0),
    status: z.coerce.number().int().optional(),
    year_period: z.coerce.number().int().optional(),
    month_period: z.coerce.number().int().optional(),
    start_date: optionalDateSchema,
    end_date: optionalDateSchema,
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
  })

export const UserBasicDetail = z
  .object({
    id: z.number(),
    username: z.string(),
    firstname: z.string().nullable(),
    lastname: z.string().nullable(),
    fullname: z.string(),
  })
  .nullable()
