import { PaginationQueriesSchema } from "@smile/lib/types/paginate.js"
import z from "zod"

export type CustomerHasActivitiesDTO = {
  customer_vendor_id: number
  activity_id: number
  created_at: Date
  updated_at: Date
  deleted_at?: Date
}

export type CustomerVendorsDTO = {
  program_id: number
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
  type: number
  name: string | null
  is_vendor?: number | null
  province_id: string | number | null
  regency_id: string | number | null
  sub_district_id: string | number | null
  village_id: string | number | null
  location?: string
}

export type EntityActivitiesDTO = {
  customer_id: number
  activity_id: number | null
}

export type EntityCustomerDTO = {
  id: number
  customer_id: number
  vendor_id: number
}

export const GetListEntityCustomerSchema = PaginationQueriesSchema.extend({
  activity_id: z
    .string()
    .or(z.number().nonnegative())
    .nullable()
    .optional()
    .refine((val) => {
      if (!val) return true;
      return !isNaN(Number(val));
    }, {
      message: "INVALID ACTIVITY ID",
    })
    .transform((val) => (val ? Number(val) : null)),
  is_consumption: z
    .enum(["0", "1"], { message: "INVALID ENUM IS_CONSUMPTION" })
    .transform((val) => Number(val)),
  is_vendor: z
    .enum(["0", "1"], { message: "INVALID ENUM IS_VENDOR" })
    .transform((val) => Number(val))
    .optional(),
})

export const GetListEntityCustomerRelationSchema =
  PaginationQueriesSchema.extend({
    is_consumption: z
      .enum(["0", "1"], { message: "INVALID ENUM IS_CONSUMPTION" })
      .transform((val) => Number(val)),
  })

export const CreateEntityCustomerRequestSchema = z.object({
  entity_id: z
    .number({
      message: "INVALID ENTITY ID PARAM",
    })
    .nonnegative(),
  is_consumption: z
    .enum(["0", "1"], { message: "INVALID ENUM IS_CONSUMPTION" })
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
  entity_ids_relation: z.array(z.number().nonnegative()),
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
          .split(";")
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
