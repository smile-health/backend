import { PaginationQueriesSchema } from "@smile-health/lib/types/paginate.js"
import { IdParamsSchema } from "@smile-health/lib/types/param"
import { Context } from "hono"
import z from "zod"

export const GetListGroupTargetSchema = PaginationQueriesSchema.extend({
  keyword: z.string().optional(),
})

export const SubmitGroupTargetSchema = z.object({
  title: z.string().optional(),
  from_year: z.number().min(0),
  from_month: z.number().min(0).max(11),
  from_day: z.number().min(0).max(29),
  to_year: z.number().min(0),
  to_month: z.number().min(0).max(11),
  to_day: z.number().min(0).max(29),
})

export const UpdateGroupTargetSchema = z.object({
  title: z.string().optional(),
  is_active: z.boolean().optional(),
  from_year: z.number().min(0).optional(),
  from_month: z.number().min(0).max(11).optional(),
  from_day: z.number().min(0).max(29).optional(),
  to_year: z.number().min(0).optional(),
  to_month: z.number().min(0).max(11).optional(),
  to_day: z.number().min(0).max(29).optional(),
})

export const UpdateGroupTargetParamSchema = IdParamsSchema

export const ImportTargetGroupRequestSchema = (c: Context) => {
  const EXCEL_COLUMNS = {
    name: c.var.t("annual_planning_group_target.column.name"),
    from_year: c.var.t("annual_planning_group_target.column.from_year"),
    from_month: c.var.t("annual_planning_group_target.column.from_month"),
    from_day: c.var.t("annual_planning_group_target.column.from_day"),
    to_year: c.var.t("annual_planning_group_target.column.to_year"),
    to_month: c.var.t("annual_planning_group_target.column.to_month"),
    to_day: c.var.t("annual_planning_group_target.column.to_day"),
  }

  const numberCell = z
    .union([z.number(), z.string()])
    .transform((val) => (val === "" ? undefined : Number(val)))
    .refine((v) => !Number.isNaN(v), "Must be a valid number")

  const schema = z.object({
    [EXCEL_COLUMNS.name]: z.string(),
    [EXCEL_COLUMNS.from_year]: numberCell.pipe(z.number().min(0)),
    [EXCEL_COLUMNS.from_month]: numberCell.pipe(z.number().min(0).max(11)),
    [EXCEL_COLUMNS.from_day]: numberCell.pipe(z.number().min(0).max(29)),
    [EXCEL_COLUMNS.to_year]: numberCell.pipe(z.number().min(0)),
    [EXCEL_COLUMNS.to_month]: numberCell.pipe(z.number().min(0).max(11)),
    [EXCEL_COLUMNS.to_day]: numberCell.pipe(z.number().min(0).max(29)),
  })

  const transformedRow = schema.transform((row) => ({
    name: `${row[EXCEL_COLUMNS.name]}`,
    from_year: Number(row[EXCEL_COLUMNS.from_year]),
    from_month: Number(row[EXCEL_COLUMNS.from_month]),
    from_day: Number(row[EXCEL_COLUMNS.from_day]),
    to_year: Number(row[EXCEL_COLUMNS.to_year]),
    to_month: Number(row[EXCEL_COLUMNS.to_month]),
    to_day: Number(row[EXCEL_COLUMNS.to_day]),
  }))

  return z.array(transformedRow).min(1, {
    message: "rows cannot be empty",
  })
}

export type GetListGroupTargetQueries = z.infer<typeof GetListGroupTargetSchema>
export type SubmitGroupTargetRequest = z.infer<typeof SubmitGroupTargetSchema>
export type UpdateGroupTargetRequest = z.infer<typeof UpdateGroupTargetSchema>
export type ImportTargetGroupRequest = z.infer<
  ReturnType<typeof ImportTargetGroupRequestSchema>
>

export type RowType = string | number | Date | null
