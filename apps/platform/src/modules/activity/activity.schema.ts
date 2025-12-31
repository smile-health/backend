import { PaginationQueriesSchema } from "@smile/lib/types/paginate.js"
import { IdParamsSchema } from "@smile/lib/types/param.js"
import { BOTTOM_UP_TOP_DOWN_LIST } from "@/common/constants/activity.js"
import z from "zod"

const requiredTopDownBottomUpRegular = (minValue: number, maxValue: number) => {
  return z.unknown().superRefine(async (val, ctx) => {
    if (val === undefined || val === null) {
      ctx.addIssue({
        message: "validator.required",
        code: z.ZodIssueCode.custom,
      })
    } else {
      if (typeof val !== "number" || !Number.isInteger(val)) {
        ctx.addIssue({
          message: "validator.integer",
          code: z.ZodIssueCode.custom,
        })
      } else {
        if (val < minValue) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "validator.not_less_than_0",
          })
        }
        if (val > maxValue) {
          ctx.addIssue({
            message: "validator.not_greater_than_1",
            code: z.ZodIssueCode.custom,
          })
        }
      }
    }
  })
}

const requiredTopDownBottomUpImport = () => {
  return z.unknown().superRefine(async (val, ctx) => {
    if (val === undefined || val === null) {
      ctx.addIssue({
        message: "validator.required",
        code: z.ZodIssueCode.custom,
      })
    } else {
      if (typeof val !== "string") {
        ctx.addIssue({
          message: "validator.string",
          code: z.ZodIssueCode.custom,
        })
      } else {
        if (val.trim().length === 0) {
          ctx.addIssue({
            message: "validator.not_empty",
            code: z.ZodIssueCode.custom,
          })
        }

        const allowValues = BOTTOM_UP_TOP_DOWN_LIST
        if (!allowValues.includes(val.toUpperCase())) {
          ctx.addIssue({
            message: "validator.only_yes_no",
            code: z.ZodIssueCode.custom,
          })
        }
      }
    }
  })
}

export const requiredNameString = (minValue: number, maxValue: number) => {
  return z.unknown().superRefine(async (val, ctx) => {
    if (val === undefined || val === null) {
      ctx.addIssue({
        message: "validator.required",
        code: z.ZodIssueCode.custom,
      })
    } else {
      if (typeof val !== "string") {
        ctx.addIssue({
          message: "validator.string",
          code: z.ZodIssueCode.custom,
        })
      } else {
        if (val.trim().length < minValue) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "validator.not_empty",
          })
        }
        if (val.trim().length > maxValue) {
          ctx.addIssue({
            message: "validator.not_exceed_255",
            code: z.ZodIssueCode.custom,
          })
        }
      }
    }
  })
}

export const COL = {
  Name: "name",
  BottomUp: "is_ordered_sales",
  TopDown: "is_ordered_purchase",
}

const ActivityRequestSchema = z.object({
  name: requiredNameString(1, 255),
  is_ordered_sales: requiredTopDownBottomUpRegular(0, 1),
  is_ordered_purchase: requiredTopDownBottomUpRegular(0, 1),
})

const ImportActivityRowSchema = z.object({
  [COL.Name]: requiredNameString(1, 255),
  [COL.BottomUp]: requiredTopDownBottomUpImport(),
  [COL.TopDown]: requiredTopDownBottomUpImport(),
})

const ImportActivityArraySchema = z.array(ImportActivityRowSchema)

export const GetActivityQuerySchema = PaginationQueriesSchema

export const GetActivityParamSchema = IdParamsSchema

export const CreateActivityRequestSchema = ActivityRequestSchema

export const UpdateActivityParamSchema = IdParamsSchema

export const UpdateActivityRequestSchema = ActivityRequestSchema

export const DeleteActivityParamSchema = IdParamsSchema

export const ImportActivityRowRequestSchema = ImportActivityRowSchema

export const ImportActivityArrayRequestSchema = ImportActivityArraySchema

type UserCreatedActivityAdditionalDTO = {
  created_by: number
}

type UserUpdatedActivityAdditionalDTO = {
  updated_by: number
}

export type GetActivityQuery = z.infer<typeof GetActivityQuerySchema>
export type CreateActivityRequest = z.infer<typeof CreateActivityRequestSchema>
export type UpdateActivityRequest = z.infer<typeof UpdateActivityRequestSchema>
export type ImportActivityRowRequest = z.infer<
  typeof ImportActivityRowRequestSchema
>
export type ImportActivityArrayRequest = z.infer<
  typeof ImportActivityArrayRequestSchema
>

export type CreateActivityRequestDTO = CreateActivityRequest &
  UserCreatedActivityAdditionalDTO &
  UserUpdatedActivityAdditionalDTO

export type UpdateActivityRequestDTO = UpdateActivityRequest &
  UserUpdatedActivityAdditionalDTO
