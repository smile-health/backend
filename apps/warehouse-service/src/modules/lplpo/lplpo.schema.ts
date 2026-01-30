import { LIST_PAGINATION } from "@smile-health/lib/types/paginate.js"
import { z } from "zod"

export const LplpoQueryParamsSchema = z
  .object({
    entity_id: z.string().min(1),
    activity_id: z.string().optional(),
    province_id: z.string().optional(),
    regency_id: z.string().optional(),
    search: z.string().optional(),
    sub_district_id: z.string().optional(),
    period: z.string().optional(), // "monthly" or "yearly"
    start_date: z.string().date(), // Format: YYYY-MM-DD
    end_date: z.string().date(), // Format: YYYY-MM-DD
    export: z
      .string()
      .optional()
      .transform((val) => val === "true")
      .default("false"),
    page: z
      .string()
      .optional()
      .transform((val) => (val ? Number(val) : 1))
      .refine((v) => !isNaN(v!) && v > 0, { message: "invalid page param" }),
    paginate: z
      .string()
      .optional()
      .transform((val) => (val ? Number(val) : 50))
      .refine((v) => !isNaN(v!) && v > 0 && LIST_PAGINATION.includes(v), {
        message: "invalid paginate param",
      }),
  })
  .refine(
    (data) => {
      console.log("LPLPO Query Params for Validation:", data)
      // Skip validation if either date is missing
      if (!data.start_date || !data.end_date) {
        return true
      }

      // Parse dates
      const startDate = new Date(data.start_date)
      const endDate = new Date(data.end_date)

      // Validate date format
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return false
      }

      // Check if both dates are in the same month and year
      const sameMonth = startDate.getMonth() === endDate.getMonth()
      const sameYear = startDate.getFullYear() === endDate.getFullYear()

      return sameMonth && sameYear
    },
    {
      message:
        "start_date and end_date must be in the same month and year (e.g., 2025-11-01 to 2025-11-30)",
      path: ["start_date"],
    }
  )
export const LplpoQueryParamsExportSchema = z
  .object({
    entity_id: z.string().optional(),
    activity_id: z.string().optional(),
    province_id: z.string().optional(),
    regency_id: z.string().optional(),
    search: z.string().optional(),
    sub_district_id: z.string().optional(),
    period: z.string().optional(), // "monthly" or "yearly"
    start_date: z.string().date(), // Format: YYYY-MM-DD
    end_date: z.string().date(), // Format: YYYY-MM-DD
    page: z
      .string()
      .optional()
      .transform((val) => (val ? Number(val) : 1))
      .refine((v) => !isNaN(v!) && v > 0, { message: "invalid page param" }),
    limit: z
      .string()
      .optional()
      .transform((val) => (val ? Number(val) : 50))
      .refine((v) => !isNaN(v!) && v > 0 && LIST_PAGINATION.includes(v), {
        message: "invalid paginate param",
      }),
  })
  .refine(
    (data) => {
      // Skip validation if either date is missing
      if (!data.start_date || !data.end_date) {
        return true
      }

      // Parse dates
      const startDate = new Date(data.start_date)
      const endDate = new Date(data.end_date)

      // Validate date format
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return false
      }

      // Check if both dates are in the same month and year
      const sameMonth = startDate.getMonth() === endDate.getMonth()
      const sameYear = startDate.getFullYear() === endDate.getFullYear()

      return sameMonth && sameYear
    },
    {
      message:
        "start_date and end_date must be in the same month and year (e.g., 2025-11-01 to 2025-11-30)",
      path: ["start_date"],
    }
  )
