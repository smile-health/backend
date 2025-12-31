import { KFA_LEVEL_CODE_LIST } from "@/common/constants/material.js"
import {
  WsEntityMaterialActivities,
  WsEntityMaterialImportLogs,
} from "@/common/infrastructure/database/types/db.js"
import { PaginationQueriesSchema } from "@smile/lib/types/paginate.js"
import { IdSchema } from "@smile/lib/types/param.js"
import { Selectable } from "kysely"
import moment from "moment"
import z from "zod"

export const DetailSchema = z.object({
  entityId: z
    .string()
    .transform((v) => Number(v))
    .refine((v) => !isNaN(v), { message: "Invalid param entity_id" }),
})

export const DeleteSchema = DetailSchema.extend({
  entityMasterMaterialActivityId: z
    .string()
    .transform((v) => Number(v))
    .refine((v) => !isNaN(v), {
      message: "Invalid param entity_master_material_activity_id",
    }),
})

export const GeneralKeywordSchema = (field) =>
  z
    .string()
    .max(255, {
      message: `${field} provided exceeds the maximum length of 255 characters`,
    })
    .optional()

export const GeneralSchema = z.object({
  material_id: z.number(),
  entity_id: z.number(),
  activity_id: z.number(),
  consumption_rate: z.number().optional().nullable(),
  retailer_price: z.number().optional().nullable(),
  tax: z.number().optional().nullable(),
  min: z.number().optional().nullable(),
  max: z.number().optional().nullable(),
  kfa_level: z.number().optional(),
  entityMaterialId: z.number().default(0).optional(),
})

export const GetEntityMaterialQueriesSchema = PaginationQueriesSchema.extend({
  keyword: GeneralKeywordSchema("Material name"),
  entity_id: z
    .string()
    .transform((val) => Number(val))
    .refine((v) => !isNaN(v), { message: "invalid entity_id" })
    .optional(),
  kfa_level: z
    .string()
    .transform((val) => Number(val))
    .refine((v) => !isNaN(v), { message: "invalid kfa_level" })
    .refine((v) => KFA_LEVEL_CODE_LIST.includes(v), {
      message: "kfa_level not registered",
    })
    .optional(),
})

export const CreateSchema = GeneralSchema.extend({}).refine(
  (data) => (data.max ?? 0) >= (data.min ?? 0),
  {
    message: "max must be greater than min",
    path: ["max"],
  }
)

export const UpdateSchema = GeneralSchema.extend({
  entity_master_material_activities_id: z.number(),
  entity_master_material_id: z.number(),
}).refine((data) => (data.max ?? 0) >= (data.min ?? 0), {
  message: "max must be greater than min",
  path: ["max"],
})

export const generalMultipleIdSchema = z
  .string()
  .refine(
    (val) =>
      val
        .split(",")
        .filter((item) => item !== "")
        .every((num) => !isNaN(Number(num))),
    {
      message: "validator.number",
    }
  )
  .transform((val) => val.split(",").filter((item) => item !== ""))

export const GetTemplateEntityMaterialSchema = z.object({
  entity_name: GeneralKeywordSchema("Entity name"),
  entity_type_id: z.string(),
  entity_tag_id: z.string(),
  province_id: z.string(),
  regency_id: z.string(),
  subdistrict_id: z.string(),
  village_id: z.string(),
  material_name: GeneralKeywordSchema("Material name"),
  material_type: z.string(),
  activity_id: z.string(),
  material_level: z.string(),
})

export type GetTemplateEntityMaterialQueries = {
  activity_id: string[] | undefined
  entity_type_id: string[] | undefined
  entity_tag_id: number[] | undefined
  province_id: string[] | undefined
  regency_id: string[] | undefined
  subdistrict_id: string[] | undefined
  village_id: string[] | undefined
  material_type: string[] | undefined
  material_level: string[] | undefined
  entity_name: string | undefined
  material_name: string | undefined
}

export type GetEntityMaterialsQueries = z.infer<
  typeof GetEntityMaterialQueriesSchema
>

export type GetEntityMaterialsParams = z.infer<typeof DetailSchema>

export type DeleteEntityMaterialsParams = z.infer<typeof DeleteSchema>

export type CreateEntityMaterialRequest = z.infer<typeof CreateSchema>

export type UpdateEntityMaterialRequest = z.infer<typeof UpdateSchema>

export type CudDTO = {
  created_by: number
  created_at: Date
  updated_by: number
  updated_at: Date
  deleted_by: number | null
  deleted_at: Date | null
}

export type UpdateEntityMaterialActivityDTO = Omit<
  CreateEntityMaterialRequest & CudDTO,
  "entity_id" | "master_material_id"
>

export type CreateEntityMaterialActivityDTO = Selectable<
  Omit<WsEntityMaterialActivities, "id">
>

export type EntityMaterialDTO = {
  entity_id?: number
  material_id?: number
  activity_id?: number
  max?: number
  min?: number
  consumption_rate?: number
  retailer_price?: number
  tax?: number
  // allocated_stock: number
  // on_hand_stock: number
  // stock_last_update: Date | null
  // total_open_vial: number
  // extermination_discard_qty: number
  // extermination_qty: number
  // extermination_received_qty: number
  // extermination_shipped_qty: number
  created_at?: Date
  // created_by?: number | null
  updated_at?: Date
  // updated_by?: number | null
  deleted_at?: Date | null
  // deleted_by?: number | null
}

export type EntityUpdateUserAndDateDTO = {
  updated_at?: Date
  updated_by?: number | null
}

export type SelectEntityMaterialDTO =
  | { id: number; deleted_at?: Date | null }
  | undefined

export type WsEntityMaterialActivitiesDTO =
  Selectable<WsEntityMaterialActivities>

export interface MasterMaterialActivityData {
  id: number
  activity: string | null
  material: string | null
}

export const arrayNumber = z.number().transform((val) => [val])
export type ColumnImportSchema = {
  EntityId: string
  MaterialActivityId: string
  Min: string
  Max: string
  ConsumptionRate: string
  RetailerPrice: string
  Tax: string
}

export const ImportEntityMaterialRowSchema = (COL: ColumnImportSchema) =>
  z
    .object({
      [COL.EntityId]: IdSchema.or(z.number()),
      [COL.MaterialActivityId]: IdSchema.or(z.number()),
      [COL.Min]: IdSchema.optional().or(z.number()),
      [COL.Max]: IdSchema.optional().or(z.number()),
      [COL.ConsumptionRate]: IdSchema.optional().or(z.number()),
      [COL.RetailerPrice]: IdSchema.optional().or(z.number()),
      [COL.Tax]: IdSchema.optional().or(z.number()),
      activity_id: z.number().optional(),
      material_id: z.number().optional(),
    })
    .transform(
      (row) =>
        ({
          entityId: Number(row[COL.EntityId]),
          materialActivityId: Number(row[COL.MaterialActivityId]),
          min: row[COL.Min],
          max: row[COL.Max],
          consumptionRate: row[COL.ConsumptionRate],
          retailerPrice: row[COL.RetailerPrice],
          tax: row[COL.Tax],
          activityId: row.activity_id,
          materialId: row.material_id,
        }) as ImportEntityMaterialRequest
    )

export const ImportEntityMaterialRequestSchema = (COL: ColumnImportSchema) =>
  z.array(ImportEntityMaterialRowSchema(COL)).min(1, {
    message: "rows cannot be empty",
  })

export type Ehmm = {
  id: number
  entity_id: number
  master_material_id: number
  deleted_at: Date | null
}

export type Emma = Ehmm & {
  emma_id: number
  emma_deleted_at: Date | null
}

export type ImportEntityMaterialRequest = {
  entityId: number
  materialActivityId: number
  min?: number
  max: number | undefined
  consumptionRate: number | undefined
  retailerPrice: number | undefined
  tax: number | undefined
  activityId: number
  materialId: number
  // item
  ehmm: Ehmm | undefined
  emma: Emma | undefined
}

export type CreateLogImportEntityMaterialDTO = Selectable<
  Omit<WsEntityMaterialImportLogs, "id">
>
const dateSchema = z
  .string()
  .refine(
    (v) => {
      if (!v) return true
      return moment(v).isValid()
    },
    { message: "validator.date" }
  )
  .optional()

export const GetImportEntityMaterialQueriesSchema =
  PaginationQueriesSchema.extend({
    start_date: dateSchema,
    end_date: dateSchema,
  }).superRefine((val, c) => {
    if (val.start_date && val.end_date) {
      if (val.start_date > val.end_date) {
        c.addIssue({
          code: z.ZodIssueCode.custom,
          message: "validator.end_date_before_start_date",
          path: ["end_date"],
        })
      }
    }
    if (val.start_date && moment(val.start_date).isValid() && !val.end_date) {
      c.addIssue({
        code: z.ZodIssueCode.custom,
        message: "validator.required",
        path: ["end_date"],
      })
    }
    if (!val.start_date && val.end_date && moment(val.end_date).isValid()) {
      c.addIssue({
        code: z.ZodIssueCode.custom,
        message: "validator.required",
        path: ["start_date"],
      })
    }
  })

export type GetImportEntityMaterialQueries = z.infer<
  typeof GetImportEntityMaterialQueriesSchema
>
