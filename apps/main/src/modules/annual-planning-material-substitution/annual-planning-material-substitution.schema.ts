import { PaginationQueriesSchema } from "@smile/lib/types/paginate.js"
import z from "zod"
import { Context } from "hono"
import {
  IdParamsSchema,
  IdSchema as numberInParamSchema,
} from "@smile/lib/types/param.js"

export const GetListMaterialSubstitutionSchema = PaginationQueriesSchema.extend(
  {
    material_id: numberInParamSchema.nullish(),
  }
)

export const SubmitMaterialSubstitutionSchema = z.object({
  material_id: z.number().nonnegative(),
  substitution_material_ids: z.array(z.number().nonnegative()).min(1),
})

export type GetListMaterialSubstitutionQueries = z.infer<
  typeof GetListMaterialSubstitutionSchema
>

export const MaterialIdSchema = IdParamsSchema.extend({
  material_id: numberInParamSchema,
})

export const SubstitutionIdSchema = IdParamsSchema.extend({
  substitution_id: numberInParamSchema,
})

export const QuerySchema = PaginationQueriesSchema.extend({
  keyword: z.string().nullish(),
  material_id: numberInParamSchema.nullish(),
  subtype_id: numberInParamSchema.nullish(),
  plan_id: numberInParamSchema.nullish(),
  is_for_filter: z
    .string()
    .refine((val) => val === "0" || val === "1", {
      message: "validator.boolean_number",
    })
    .transform((val) => Boolean(Number(val)))
    .nullish(),
  is_planned_only: z
    .string()
    .refine((val) => val === "0" || val === "1", {
      message: "validator.boolean_number",
    })
    .transform((val) => Boolean(Number(val)))
    .nullish(),
  exclude_ids: z
    .string()
    .regex(/^\d+(,\d+)*$/, "Invalid format")
    .or(z.literal(""))
    .nullish(),
})

export type GetListMaterialForOptionQueries = z.infer<typeof QuerySchema>

export type SubmitMaterialSubstitutionRequest = z.infer<
  typeof SubmitMaterialSubstitutionSchema
> & {
  created_by: number
  updated_by: number
  program_plan_id: number
}

export type TSubmitMaterialSubstitutionArgs = {
  context: Context
  params: { planId: number; substitutionId?: number }
  body: z.infer<typeof SubmitMaterialSubstitutionSchema>
}

export type ColumnImportSchema = {
  MaterialId: string
  SubstitutionId: string
}

export type ImportMaterialSubstitutionSchema = {
  MaterialId: number
  SubstitutionId: Array<number>
}

const numbersFromString = z.union([
  z
    .number()
    .nonnegative()
    .transform((n) => [n]),
  z
    .string()
    .nonempty({ message: "Input required" })
    .refine(
      (s) => {
        const parts = s
          .split(";")
          .map((p) => p.trim())
          .filter(Boolean)
        return parts.length > 0 && parts.every((p) => /^\d+$/.test(p))
      },
      {
        message:
          "Must be a number or semicolon-separated numbers (e.g. '2' or '2;3;4')",
      }
    )
    .transform((s) => s.split(";").map((p) => Number(p.trim()))),
])

export const ImportMaterialSubstitutionRequestRowSchema = (
  inputCol: ColumnImportSchema
) =>
  z
    .object({
      [inputCol.MaterialId]: z.number().nonnegative(),
      [inputCol.SubstitutionId]: numbersFromString,
    })
    .transform(
      (row) =>
        ({
          MaterialId: row[inputCol.MaterialId],
          SubstitutionId: row[inputCol.SubstitutionId],
        }) as ImportMaterialSubstitutionSchema
    )

export const ImportMaterialSubstitutionRequestSchema = (
  inputCol: ColumnImportSchema
) =>
  z.array(ImportMaterialSubstitutionRequestRowSchema(inputCol)).min(1, {
    message: "rows cannot be empty",
  })
