import { PaginationQueriesSchema } from "@smile/lib/types/paginate.js"
import z from "zod"

export type CustomerHasActivitiesDTO = {
  vendor_id: number
  customer_id: number
  activity_id: number
  created_at: Date
  updated_at: Date
  deleted_at?: Date
}

export type CustomerVendorsDTO = {
  customer_id: number
  vendor_id: number
  is_distribution: number
  is_consumption: number
  created_at: Date
  updated_at: Date
  deleted_at?: Date
}

export type ImportEntityCustomerDTO = {
  entity_id_relation: number
  activity_ids: number[]
}

export type EntityDetailRelationCustomerDTO = {
  id: number
  province_id: string | null
  regency_id: string | null
  sub_district_id: string | null
  village_id: string | null
}

export const GetListEntityCustomerSchema = PaginationQueriesSchema.extend({
  is_consumption: z
    .enum(["0", "1"], { message: "INVALID_ENUM_STATUS" })
    .transform((val) => Number(val)),
})

export const GetExcelFileListEntityCustomerSchema = z.object({
  is_consumption: z
    .enum(["0", "1"], { message: "INVALID_ENUM_STATUS" })
    .transform((val) => Number(val)),
})

export const GetListEntityCustomerRelationSchema =
  PaginationQueriesSchema.extend({
    is_consumption: z
      .enum(["0", "1"], { message: "INVALID_ENUM_STATUS" })
      .transform((val) => Number(val)),
  })

export const CreateEntityCustomerRequestSchema = z.object({
  entity_id: z
    .number({
      message: "INVALID ENTITY ID PARAM",
    })
    .nonnegative(),
  is_consumption: z
    .enum(["0", "1"], { message: "INVALID_ENUM_STATUS" })
    .transform((val) => Number(val)),
  add: z.array(
    z.object({
      entity_id_relation: z
        .number({
          message: "INVALID ENTITY ID PARAM",
        })
        .nonnegative(),
      activity_ids: z.array(z.number().nonnegative()),
    })
  ),
})

export const UpdateEntityCustomerRequestSchema = z.object({
  entity_id: z
    .number({
      message: "INVALID ENTITY ID PARAM",
    })
    .nonnegative(),
  entity_id_relation: z
    .number({
      message: "INVALID ENTITY ID PARAM",
    })
    .nonnegative(),
  activity_ids: z.array(z.number().nonnegative()),
})

export const DeleteEntityCustomerRequestSchema = z.object({
  entity_id: z
    .number({
      message: "INVALID ENTITY ID PARAM",
    })
    .nonnegative(),
  entity_id_relation: z
    .number({
      message: "INVALID ENTITY ID PARAM",
    })
    .nonnegative(),
})

export const UpdateImportEntityCustomerRequestSchema = z.object({
  entity_id_relation: z
    .number({
      message: "INVALID ENTITY ID PARAM",
    })
    .nonnegative(),
  activity_ids: z.array(z.number().nonnegative()),
})

export const COL = {
  id: { CustomerEntityId: "ID Entitas Pelanggan", ActivityID: "ID Kegiatan" },
  en: { CustomerEntityId: "Customer Entity ID", ActivityID: "Activity ID" },
}

const ImportEntityRowENSchema = z.object({
  [COL.en.CustomerEntityId]: z.string().or(z.number().positive()),
  [COL.en.ActivityID]: z.string().or(z.number().positive()),
})

const ImportEntityRowIDSchema = z.object({
  [COL.id.CustomerEntityId]: z.string().or(z.number().positive()),
  [COL.id.ActivityID]: z.string().or(z.number().positive()),
})

export const ImportEntityRowSchema = z
  .union([ImportEntityRowENSchema, ImportEntityRowIDSchema])
  .transform(
    (row) =>
      ({
        entity_id_relation: row[COL.id.CustomerEntityId]
          ? Number(row[COL.id.CustomerEntityId])
          : Number(row[COL.en.CustomerEntityId]),
        activity_ids: (row[COL.id.ActivityID] ?? row[COL.en.ActivityID])!
          .toString()
          .split("|")
          .map(Number),
      }) as UpdateImportEntityCustomerRequest
  )

export const ImportEntityCustomerRequestSchema = z
  .array(ImportEntityRowSchema)
  .min(1, {
    message: "rows cannot be empty",
  })

export type GetEntitiesCustomersQueries = z.infer<
  typeof GetListEntityCustomerSchema
>
export type GetEntitiesCustomersRelationQueries = z.infer<
  typeof GetListEntityCustomerRelationSchema
>
export type GetExcelFileEntitiesCustomerQueries = z.infer<
  typeof GetExcelFileListEntityCustomerSchema
>
export type CreateEntityCustomerRequest = z.infer<
  typeof CreateEntityCustomerRequestSchema
>
export type UpdateEntityCustomerRequest = z.infer<
  typeof UpdateEntityCustomerRequestSchema
>
export type UpdateImportEntityCustomerRequest = z.infer<
  typeof UpdateImportEntityCustomerRequestSchema
>
export type ImportEntityCustomerRequest = z.infer<
  typeof ImportEntityCustomerRequestSchema
>
export type DeleteEntityCustomerRequest = z.infer<
  typeof DeleteEntityCustomerRequestSchema
>
