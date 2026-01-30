import { PaginationQueriesSchema } from "@smile-health/lib/types/paginate.js"
import { DateSchema } from "@smile-health/lib/types/param.js"
import { z } from "zod"

export const GetImportLogQueriesSchema = PaginationQueriesSchema.extend({
  start_date: DateSchema.optional(),
  end_date: DateSchema.optional(),
}).superRefine((val, c) => {
  const isValidDate = (d: unknown): d is Date =>
    d instanceof Date && !Number.isNaN(d.getTime())

  const hasStart = isValidDate(val.start_date)
  const hasEnd = isValidDate(val.end_date)

  if (hasStart && hasEnd && (val.start_date as Date) > (val.end_date as Date)) {
    c.addIssue({
      code: z.ZodIssueCode.custom,
      message: "validator.end_date_before_start_date",
      path: ["end_date"],
    })
  }

  if (hasStart && !hasEnd) {
    c.addIssue({
      code: z.ZodIssueCode.custom,
      message: "validator.required",
      path: ["end_date"],
    })
  }

  if (!hasStart && hasEnd) {
    c.addIssue({
      code: z.ZodIssueCode.custom,
      message: "validator.required",
      path: ["start_date"],
    })
  }
})
export type GetImportLogQueries = z.infer<typeof GetImportLogQueriesSchema>

export const PatientImportRequestSchema = z.object({
  name: z.string({
    invalid_type_error: "validator.string",
    required_error: "validator.required",
  }),
  identity_type: z.string({
    invalid_type_error: "validator.string",
    required_error: "validator.required",
  }),
  identity_number: z.string({
    invalid_type_error: "validator.string",
    required_error: "validator.required",
  }),
  date_of_birth: z.preprocess(
    (v) => {
      if (typeof v === "string") {
        if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v
        const m = v.match(/^\d{4}-\d{2}-\d{2}/)
        if (m) return m[0]
      }
      if (typeof v === "number" && Number.isFinite(v)) {
        // Excel serial date to YYYY-MM-DD (Excel epoch: 1899-12-30), cause we use SheetJSProcessor
        const base = new Date(Date.UTC(1899, 11, 30))
        const ms = Math.round(v) * 24 * 60 * 60 * 1000
        const dt = new Date(base.getTime() + ms)
        return dt.toISOString().slice(0, 10)
      }
      if (v instanceof Date) {
        return v.toISOString().slice(0, 10)
      }
      return v
    },
    z
      .string({
        invalid_type_error: "validator.string",
        required_error: "validator.required",
      })
      .regex(/^\d{4}-\d{2}-\d{2}$/, { message: "validator.date" })
  ),
  gender: z.string({
    invalid_type_error: "validator.string",
    required_error: "validator.required",
  }),
  status: z.string({ invalid_type_error: "validator.string" }).nullish(),
  education: z.string({ invalid_type_error: "validator.string" }).nullish(),
  occupation: z.string({ invalid_type_error: "validator.string" }).nullish(),
  religion: z.string({ invalid_type_error: "validator.string" }).nullish(),
  ethnicity: z.string({ invalid_type_error: "validator.string" }).nullish(),
  phone_number: z
    .string({
      invalid_type_error: "validator.string",
      required_error: "validator.required",
    })
    .regex(/^[1-9]\d{7,14}$/, { message: "validator.string" }),
  province: z.string({ invalid_type_error: "validator.string" }).nullish(),
  city: z.string({ invalid_type_error: "validator.string" }).nullish(),
  address: z.string({ invalid_type_error: "validator.string" }).nullish(),
  province_residence: z
    .string({ invalid_type_error: "validator.string" })
    .nullish(),
  city_residence: z
    .string({ invalid_type_error: "validator.string" })
    .nullish(),
  residential_address: z
    .string({ invalid_type_error: "validator.string" })
    .nullish(),
  dengue_history: z
    .string({ invalid_type_error: "validator.string" })
    .nullish(),
  month: z
    .union([z.string(), z.number()])
    .nullish()
    .transform((v) => (v == null || v === "" ? null : Number(v))),
  year: z
    .union([z.string(), z.number()])
    .nullish()
    .transform((v) => (v == null || v === "" ? null : Number(v))),
  vaccination_history: z
    .string({ invalid_type_error: "validator.string" })
    .nullish(),
})
export type PatientImportRequestDTO = z.infer<typeof PatientImportRequestSchema>
