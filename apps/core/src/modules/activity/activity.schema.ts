import { BOTTOM_UP_TOP_DOWN_LIST } from "@/common/constants/activity.js"
import { PaginationQueriesSchema } from "@smile/lib/types/paginate.js"
import { IdParamsSchema } from "@smile/lib/types/param.js"
import z from "zod"

const requiredTopDownBottomUpRegular = (minValue: number, maxValue: number) => {
  return z.unknown().superRefine((val, ctx) => {
    if (val === undefined || val === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "validator.required",
      })
      return
    }

    if (typeof val !== "number" || !Number.isInteger(val)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "validator.integer",
      })
      return
    }

    if (val < minValue) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "validator.not_less_than_0",
      })
    }

    if (val > maxValue) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "validator.not_greater_than_1",
      })
    }
  })
}

const requiredTopDownBottomUpImport = () => {
  return z.unknown().superRefine((val, ctx) => {
    if (val === undefined || val === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "validator.required",
      })
      return
    }

    if (typeof val !== "string") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "validator.string",
      })
      return
    }

    const trimmed = val.trim()
    if (trimmed.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "validator.not_empty",
      })
      return
    }

    const allowValues = BOTTOM_UP_TOP_DOWN_LIST
    if (!allowValues.includes(trimmed.toUpperCase())) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "validator.only_yes_no",
      })
    }
  })
}

const requiredNameString = (minValue: number, maxValue: number) => {
  return z.unknown().superRefine((val, ctx) => {
    if (val === undefined || val === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "validator.required",
      })
      return
    }

    if (typeof val !== "string") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "validator.string",
      })
      return
    }

    const trimmed = val.trim()
    if (trimmed.length < minValue) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "validator.not_empty",
      })
    }

    if (trimmed.length > maxValue) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "validator.not_exceed_255",
      })
    }
  })
}

const requiredProtocolString = (minValue: number, maxValue: number) => {
  const allowedValues = ["default", "rabies", "dengue"]

  return z.unknown().superRefine((val, ctx) => {
    if (val === undefined || val === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "validator.required",
      })
      return
    }

    if (typeof val !== "string") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "validator.string",
      })
      return
    }

    const trimmed = val.trim()

    if (trimmed.length < minValue) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "validator.not_empty",
      })
    }

    if (trimmed.length > maxValue) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "validator.not_exceed_255",
      })
    }

    if (!allowedValues.includes(trimmed)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "validator.not_exist",
      })
    }
  })
}

export const COL = {
  Name: "name",
  BottomUp: "is_ordered_sales",
  TopDown: "is_ordered_purchase",
  Protocol: "protocol",
}

const ActivityRequestSchema = z.object({
  name: requiredNameString(1, 255),
  is_ordered_sales: requiredTopDownBottomUpRegular(0, 1),
  is_ordered_purchase: requiredTopDownBottomUpRegular(0, 1),
  protocol: requiredProtocolString(1, 255),
})

const ImportActivityRowSchema = z.object({
  [COL.Name]: requiredNameString(1, 255),
  [COL.BottomUp]: requiredTopDownBottomUpImport(),
  [COL.TopDown]: requiredTopDownBottomUpImport(),
  [COL.Protocol]: requiredProtocolString(1, 255),
})

const ImportActivityArraySchema = z.array(ImportActivityRowSchema)

export const GetActivityQuerySchema = PaginationQueriesSchema.extend({
  sort_by: z.string().nullish().optional(),
  sort_type: z.string().nullish().optional(),
})

export const GetActivityParamSchema = IdParamsSchema

export const CreateActivityRequestSchema = ActivityRequestSchema

export const UpdateActivityParamSchema = IdParamsSchema

export const UpdateActivityRequestSchema = ActivityRequestSchema

export const ImportActivityRowRequestSchema = ImportActivityRowSchema

export const ImportActivityArrayRequestSchema = ImportActivityArraySchema

export type GetActivityQuery = z.infer<typeof GetActivityQuerySchema>

export type CreateActivityRequest = z.infer<typeof CreateActivityRequestSchema>

export type UpdateActivityRequest = z.infer<
  typeof UpdateActivityRequestSchema
> & { status?: boolean }

export type ImportActivityRowRequest = z.infer<
  typeof ImportActivityRowRequestSchema
>
export type ImportActivityArrayRequest = z.infer<
  typeof ImportActivityArrayRequestSchema
>
