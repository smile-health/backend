import { z } from "zod"
import { PaginationQueriesSchema } from "@smile-health/lib/types/paginate.js"

/* Base Schema */
export const EventReportSchema = z.object({
  id: z.number().positive(),
  entity_id: z.number().positive(),
  status_id: z.number().positive(),
  order_id: z.number().positive().nullish(),
  do_number: z.string().min(1).max(255).nullish(),
  has_order: z.number().min(0).max(1),
  arrived_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, { message: "validator.date" })
    .refine((val) => {
      const date = new Date(val)
      return !isNaN(date.getTime())
    }),
  program_id: z.number().positive(),
  link: z.string().min(1).max(255).nullish(),
  created_by: z.number().positive(),
  updated_by: z.number().positive(),
  deleted_by: z.number().positive().nullish(),
  created_at: z.date(),
  updated_at: z.date(),
  deleted_at: z.date().nullish(),
})
export const EventReportHistoriesShema = z.object({
  id: z.number().positive(),
  report_id: z.number().positive(),
  status_id: z.number().positive(),
  created_by: z.number().positive(),
  created_at: z.date(),
  updated_at: z.date(),
})
export const EventReportCommentSchema = z.object({
  id: z.number().positive(),
  report_id: z.number().positive(),
  comment: z.string().min(1).max(255),
  created_by: z.number().positive(),
  created_at: z.date(),
  updated_at: z.date(),
  deleted_at: z.date().nullish(),
})
export const EventReportItemsSchema = z.object({
  id: z.number(),
  child_reason_id: z.number().nullable().optional(),
  custom_material: z.string().nullable().optional(),
  expired_date: z.date().nullable().optional(),
  material_id: z.number().nullable().optional(),
  no_batch: z.string().nullable().optional(),
  production_date: z.date().nullable().optional(),
  qty: z.number().optional(),
  reason_id: z.number().nullable().optional(),
  report_id: z.number(),
  created_by: z.number().positive(),
  updated_at: z.date(),
  created_at: z.date(),
  deleted_at: z.date().nullable().optional(),
})
export const ListEventReportSchema = {
  id: z.number().positive().optional(),
  status_id: z
    .union([z.string(), z.number()])
    .transform((val) => Number(val))
    .optional(),
  status_label: z.string().optional(),
  entity_name: z.string().optional(),
  order_id: z
    .union([z.string(), z.number()])
    .transform((val) => Number(val))
    .optional(),
  do_number: z.string().optional(),
  arrived_date: z.date().optional(),
  created_at: z.date().optional(),
  updated_at: z.date().optional(),
}

// Validation Schema
export const CreateEventReportSchema = EventReportSchema.omit({
  id: true,
  program_id: true,
  status_id: true,
  created_by: true,
  updated_by: true,
  deleted_by: true,
  created_at: true,
  updated_at: true,
  deleted_at: true,
})
  .extend({
    items: z
      .array(
        z.object({
          material_id: z.number().positive().optional().nullable(),
          qty: z.number().positive(),
          custom_material: z.string().min(1).max(255).nullish(),
          batch_code: z.string().min(1).max(255).nullish(),
          expired_date: z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/, { message: "validator.date" })
            .refine((val) => {
              const date = new Date(val)
              return !isNaN(date.getTime())
            }),
          production_date: z.coerce.date().nullish(),
          reason_id: z.number().positive(),
          child_reason_id: z.number().positive(),
        })
      )
      .min(1),
    comment: z.string().min(1).max(255).nullish(),
  })
  .superRefine((data, ctx) => {
    if (data.has_order === 1 && !data.order_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `validator.required`,
        path: ["order_id"],
      })
    }
    if (data.has_order === 0 && !data.do_number) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `validator.required`,
        path: ["do_number"],
      })
    }
    if (
      (data.has_order === 0 || data.has_order === 1) &&
      data.do_number &&
      data.order_id
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `validator.is_null`,
        path: [data.has_order === 0 ? "order_id" : "do_number"],
      })
    }
  })
export const UpdateEventReportSchema = z.object({
  update_status_id: z.number().positive(),
  comment: z.string().min(1).max(255).nullish(),
})
export const UpdateLinkEventReportSchema = z.object({
  link: z
    .string()
    .max(255)
    .refine(
      (val) => {
        try {
          new URL(val)
          return true
        } catch {
          return false
        }
      },
      {
        message: "validator.invalid_url",
      }
    ),
})

/* DTO Schema */
export const CreateEventReportHistoryDTOSchema = EventReportHistoriesShema.omit(
  {
    id: true,
    created_at: true,
    updated_at: true,
  }
)
export const CreateEventReportCommentDTOSchema = EventReportCommentSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
  deleted_at: true,
})
export const CreateEventReportItemSchema = EventReportItemsSchema.omit({
  id: true,
  created_by: true,
  created_at: true,
  updated_at: true,
  deleted_at: true,
})
export const CreateEventReportDTOSchema = EventReportSchema.omit({
  id: true,
  link: true,
  created_at: true,
  updated_at: true,
  deleted_by: true,
  deleted_at: true,
})

/* Query Params Schema */
export const GetListEventReportSchema = PaginationQueriesSchema.extend({
  order_id: z
    .string()
    .transform((val) => Number(val))
    .refine((v) => !isNaN(v!), { message: "invalid order_id" })
    .optional(),
  status: z
    .string()
    .transform((val) => Number(val))
    .refine((v) => !isNaN(v!), { message: "invalid status" })
    .optional(),
  do_number: z.string().optional(),
  entity_id: z
    .string()
    .transform((val) => Number(val))
    .refine((v) => !isNaN(v!), { message: "invalid entity_id" })
    .optional(),
  entity_tag_id: z
    .string()
    .transform((val) => Number(val))
    .refine((v) => !isNaN(v!), { message: "invalid entity_tag_id" })
    .optional(),
  regency_id: z
    .string()
    .transform((val) => Number(val))
    .refine((v) => !isNaN(v!), { message: "invalid regency_id" })
    .optional(),
  province_id: z
    .string()
    .transform((val) => Number(val))
    .refine((v) => !isNaN(v!), { message: "invalid province_id" })
    .optional(),
  from_arrived_date: z.coerce
    .date()
    .refine((value) => value, { message: "validator.date" })
    .optional(),
  to_arrived_date: z.coerce
    .date()
    .refine((value) => value, { message: "validator.date" })
    .optional(),
  order_id_do_number: z.string().optional(),
  id: z
    .string()
    .transform((val) => Number(val))
    .refine((v) => !isNaN(v!), { message: "invalid id" })
    .optional(),
})

/* Request Body Type */
export type CreateEventReportRequest = z.infer<typeof CreateEventReportSchema>
export type UpdateEventReportRequest = z.infer<typeof UpdateEventReportSchema>
export type UpdateLinkEventReportRequest = z.infer<
  typeof UpdateLinkEventReportSchema
>

/* DTO Type */
export type CreateEventReportHistoryDTO = z.infer<
  typeof CreateEventReportHistoryDTOSchema
>
export type CreateEventReportCommentDTO = z.infer<
  typeof CreateEventReportCommentDTOSchema
>
export type CreateEventReportItemDTO = z.infer<
  typeof CreateEventReportItemSchema
>
export type CreateEventReportDTO = z.infer<typeof CreateEventReportDTOSchema>
export type UpdateEventReportDTO = z.infer<typeof UpdateEventReportSchema>

/* Query Params Type */
export type GetEventReportQueries = z.infer<typeof GetListEventReportSchema>

export type RowType = string | number | Date | null
