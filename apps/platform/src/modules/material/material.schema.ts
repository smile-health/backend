import { PaginationQueriesSchema } from "@smile/lib/types/paginate.js"
import { IdSchema, OptionalIdsSchema } from "@smile/lib/types/param.js"
import z from "zod"

export const GetMaterialsQueriesSchema = PaginationQueriesSchema.extend({
  activity_id: IdSchema.optional().or(z.literal("")).transform(Number),
  material_level_id: IdSchema.optional().or(z.literal("")).transform(Number),
  material_type_ids: IdSchema.optional().or(z.literal("")).transform(Number),
})

export const UpdateMaterialRequestSchema = z.object({
  id: z.number().default(0),
  material_companion: z.array(z.number().positive()).default([]),
  manufactures: z.array(z.number().positive()).min(1),
  activities: z
    .array(
      z.object({
        id: z.number().positive(),
        is_sequence: z.number().nonnegative(),
      })
    )
    .min(1),
  is_addremove: z.number().default(0),
  addremove: z.object({
    entity_types: z.array(z.number()).default([]),
    roles: z.array(z.number()).default([]),
  }),
})

export const UpdateStatusRequestSchema = z.object({
  status: z.union([z.literal(0), z.literal(1)]),
})

export type GetMaterialsQueries = z.infer<typeof GetMaterialsQueriesSchema>
export type UpdateMaterialRequest = z.infer<typeof UpdateMaterialRequestSchema>
export type UpdateStatusRequest = z.infer<typeof UpdateStatusRequestSchema>

export type MaterialConditionDTO = {
  entity_types: number[]
  roles: number[]
}

export const arrayNumber = z.number().transform((val) => [val])
export const COL = {
  Id: "ID",
  Manufacture: "Manufacture",
  Activity: "Activity Non Sequence",
  SeqActivity: "Activity with sequence",
  Companion: "Material Companions",
  Roles: "Add/Remove Stock by Roles",
  EntityType: "Add/Remove Stock by Entity Type",
}

export const ImportMaterialRowSchema = z
  .object({
    [COL.Id]: z.number().positive(),
    [COL.Manufacture]: OptionalIdsSchema.optional().or(arrayNumber),
    [COL.Activity]: OptionalIdsSchema.optional().or(arrayNumber),
    [COL.SeqActivity]: OptionalIdsSchema.optional().or(arrayNumber),
    [COL.Companion]: OptionalIdsSchema.optional().or(arrayNumber),
    [COL.Roles]: OptionalIdsSchema.optional().or(arrayNumber),
    [COL.EntityType]: OptionalIdsSchema.optional().or(arrayNumber),
  })
  .superRefine((data, ctx) => {
    if (((data[COL.Manufacture] ?? []) as number[]).length === 0) {
      ctx.addIssue({
        path: [`${COL.Manufacture}`],
        message: "validator.not_empty",
        code: z.ZodIssueCode.custom,
      })
    }

    if (
      ((data[COL.Activity] ?? []) as number[]).length === 0 &&
      ((data[COL.SeqActivity] ?? []) as number[]).length === 0
    ) {
      ctx.addIssue({
        path: [`${COL.Activity} / ${COL.SeqActivity}`],
        message: "validator.not_empty",
        code: z.ZodIssueCode.custom,
      })
    }

    if (
      ((data[COL.Roles] ?? []) as number[]).length > 0 &&
      ((data[COL.EntityType] ?? []) as number[]).length === 0
    ) {
      ctx.addIssue({
        path: [COL.EntityType],
        message: "validator.not_empty",
        code: z.ZodIssueCode.custom,
      })
    }

    if (
      ((data[COL.Roles] ?? []) as number[]).length === 0 &&
      ((data[COL.EntityType] ?? []) as number[]).length > 0
    ) {
      ctx.addIssue({
        path: [COL.Roles],
        message: "validator.not_empty",
        code: z.ZodIssueCode.custom,
      })
    }
  })

export const ImportMaterialRequestSchema = z
  .array(ImportMaterialRowSchema)
  .min(1, {
    message: "rows cannot be empty",
  })
export type ImportMaterialRequest = z.infer<typeof ImportMaterialRequestSchema>
export type ImportMaterialRow = z.infer<typeof ImportMaterialRowSchema>
