import { ENTITY_TYPE } from "@/common/constants/entity.js"
import { USER_ROLE } from "@/common/constants/user.js"
import { PaginationQueriesSchema } from "@smile/lib/types/paginate.js"
import { IdSchema, MasterData } from "@smile/lib/types/param.js"
import { isArray, isObject, isString } from "lodash"
import z, { ZodTypeAny } from "zod"

export const GetMaterialsQueriesSchema = PaginationQueriesSchema.extend({
  activity_id: IdSchema.optional().or(z.literal("")).transform(Number),
  material_level_id: IdSchema.optional().or(z.literal("")).transform(Number),
  material_type_ids: IdSchema.optional().or(z.literal("")).transform(Number),
  material_subtype_ids: IdSchema.optional().or(z.literal("")).transform(Number),
  sort_by: z
    .enum(
      [
        "name",
        "material_type",
        "material_subtype",
        "min_temperature",
        "max_temperature",
        "updated_by",
      ],
      {
        message: "INVALID REQUEST SORT_BY",
      }
    )
    .optional(),
  sort_type: z
    .enum(["asc", "desc"], { message: "INVALID REQUEST SORT_TYPE" })
    .optional(),
})

function toArrayOfNumbers<I extends ZodTypeAny>(schema: I) {
  return z.preprocess((value) => {
    if (isArray(value)) {
      return value
    }

    if (isString(value)) {
      return value
        .split(/[,;]/)
        .map((item) => parseInt(item.trim(), 10))
        .filter((item) => !isNaN(item))
    }

    if (value) return [value]
  }, schema)
}

export const UpdateMaterialRequestSchema = z
  .object({
    id: z.number().default(0),

    material_companion: toArrayOfNumbers(
      z.array(z.number().positive()).default([])
    ),

    manufactures: toArrayOfNumbers(z.array(z.number().positive()).min(1)),

    activities: z
      .array(
        z.object({
          id: z.number().positive().min(1),
          is_patient_needed: z.number().min(0).max(1).default(0),
        })
      )
      .transform((arr) => ({
        activities: arr.map((a) => a.id),
        material_activities: arr,
      })),

    is_addremove: z.number().default(0),

    addremove: z.object({
      entity_types: toArrayOfNumbers(
        z.array(z.nativeEnum(ENTITY_TYPE)).default([])
      ),
      roles: toArrayOfNumbers(z.array(z.nativeEnum(USER_ROLE)).default([])),
    }),
  })
  .transform((data) => ({
    ...data.activities,
    id: data.id,
    material_companion: data.material_companion,
    manufactures: data.manufactures,
    is_addremove: data.is_addremove,
    addremove: data.addremove,
  }))

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

export type MaterialHierarchyDTO = MasterData & {
  material_level_id: number
}

export const arrayNumber = z.number().transform((val) => [val])

export const ImportUpdateMaterialRequestSchema = z.object({
  id: z.number().default(0),
  material_companion: toArrayOfNumbers(
    z.array(z.number().positive()).default([])
  ),
  manufactures: toArrayOfNumbers(z.array(z.number().positive()).min(1)),
  activities: z.preprocess((value) => {
    if (isArray(value)) {
      return value.map((val) => (isObject(val) ? val["id"] : val))
    }

    if (typeof value === "string") {
      return value
        .split(/[,;]/)
        .map((item) => parseInt(item.trim(), 10))
        .filter((item) => !isNaN(item))
    }

    return [value]
  }, z.array(z.number().positive()).min(1)),
  is_addremove: z.number().default(0),
  addremove: z.object({
    entity_types: toArrayOfNumbers(
      z.array(z.nativeEnum(ENTITY_TYPE)).default([])
    ),
    roles: toArrayOfNumbers(z.array(z.nativeEnum(USER_ROLE)).default([])),
  }),
})

export const ImportMaterialRequestSchema = z
  .array(
    ImportUpdateMaterialRequestSchema.superRefine((data, ctx) => {
      // for import excel, either roles or entity_types is required
      // if both is empty then we assume the is_addremove is 0

      if (
        data.addremove.roles.length === 0 &&
        data.addremove.entity_types.length > 0
      ) {
        ctx.addIssue({
          path: ["roles"],
          message: "validator.not_empty",
          code: z.ZodIssueCode.custom,
        })
      }

      if (
        data.addremove.roles.length > 0 &&
        data.addremove.entity_types.length === 0
      ) {
        ctx.addIssue({
          path: ["entity_types"],
          message: "validator.not_empty",
          code: z.ZodIssueCode.custom,
        })
      }
    })
  )
  .min(1, {
    message: "rows cannot be empty",
  })
export type ImportMaterialRequest = z.infer<typeof ImportMaterialRequestSchema>
