import {
  EntityWorkspaces,
  WsEntities,
} from "@/common/infrastructure/database/types/db.js"
import { PaginationQueriesSchema } from "@smile/lib/types/paginate.js"
import { OptionalIdSchema } from "@smile/lib/types/param.js"
import { Selectable } from "kysely"
import z from "zod"

export const GetListEntitySchema = PaginationQueriesSchema.extend({
  id_satu_sehat: z
    .string()
    .refine(
      (val) =>
        val
          .split(",")
          .filter((item) => item !== "")
          .every((num) => !isNaN(Number(num))),
      {
        message: "INVALID_MSI_ID_PARAM",
      }
    )
    .transform((val) => val.split(",").filter((item) => item !== ""))
    .optional(),
  type_ids: z
    .string()
    .refine(
      (val) =>
        val
          .split(",")
          .filter((item) => item !== "")
          .every((num) => !isNaN(Number(num))),
      {
        message: "INVALID_TYPE_ID_PARAM",
      }
    )
    .transform((val) => val.split(",").filter((item) => item !== ""))
    .optional(),
  entity_tag_ids: z
    .string()
    .refine(
      (val) =>
        val
          .split(",")
          .filter((item) => item !== "")
          .every((num) => !isNaN(Number(num))),
      {
        message: "INVALID_ENTITY_TAG_ID_PARAM",
      }
    )
    .transform((val) =>
      val
        .split(",")
        .filter((item) => item !== "")
        .map((item) => Number(item))
    )
    .optional(),
  province_ids: z
    .string()
    .refine(
      (val) =>
        val
          .split(",")
          .filter((item) => item !== "")
          .every((num) => !isNaN(Number(num))),
      {
        message: "INVALID_PROVINCE_ID_PARAM",
      }
    )
    .transform((val) => val.split(",").filter((item) => item !== ""))
    .optional(),
  regency_ids: z
    .string()
    .refine(
      (val) =>
        val
          .split(",")
          .filter((item) => item !== "")
          .every((num) => !isNaN(Number(num))),
      {
        message: "INVALID_REGENCY_ID_PARAM",
      }
    )
    .transform((val) => val.split(",").filter((item) => item !== ""))
    .optional(),
  sub_district_ids: z
    .string()
    .refine(
      (val) =>
        val
          .split(",")
          .filter((item) => item !== "")
          .every((num) => !isNaN(Number(num))),
      {
        message: "INVALID_SUB_DISTRICT_ID_PARAM",
      }
    )
    .transform((val) => val.split(",").filter((item) => item !== ""))
    .optional(),
  village_ids: z
    .string()
    .refine(
      (val) =>
        val
          .split(",")
          .filter((item) => item !== "")
          .every((num) => !isNaN(Number(num))),
      {
        message: "INVALID_VILLAGE_ID_PARAM",
      }
    )
    .transform((val) => val.split(",").filter((item) => item !== ""))
    .optional(),
  is_vendor: z
    .enum(["0", "1"], { message: "INVALID REQUEST is_vendor" })
    .transform((val) => Number(val))
    .optional(),
  sort_by: z
    .enum(["name", "location", "tag", "code"], {
      message: "INVALID REQUEST SORT_BY",
    })
    .optional(),
  sort_type: z
    .enum(["asc", "desc"], { message: "INVALID REQUEST SORT_TYPE" })
    .optional(),
  is_asset: z
    .enum(["0", "1"])
    .transform((val) => Number(val))
    .optional(),
  province_id: z.string().optional(),
  regency_id: z.string().optional(),
  sub_district_id: z.string().optional(),
  integration_client_id: OptionalIdSchema.nullish(),
})

export const GetInactiveEntityNotificationSchema = z.object({
  entity_ids: z
    .string()
    .refine(
      (val) =>
        val
          .split(",")
          .filter((item) => item !== "")
          .every((num) => !isNaN(Number(num))),
      {
        message: "INVALID_ENTITY_IDS_PARAM",
      }
    )
    .transform((val) =>
      val
        .split(",")
        .filter((item) => item !== "")
        .map((item) => Number(item))
    )
    .optional(),
})

export type GetInactiveEntityNotificationQueries = z.infer<
  typeof GetInactiveEntityNotificationSchema
>

export const UpdateStatusEntityRequestSchema = z.object({
  status: z
    .enum(["0", "1"], { message: "INVALID_REQUEST_STATUS" })
    .transform((val) => Number(val)),
})

export const UpdateStatusVendorEntityRequestSchema = z
  .object({
    status: z
      .enum(["0", "1"], { message: "INVALID_REQUEST_STATUS" })
      .transform((val) => Number(val)),
    is_relocation: z
      .enum(["0", "1"], { message: "INVALID_REQUEST_STATUS" })
      .transform((val) => Number(val)),
  })
  .superRefine(({ status, is_relocation }, ctx) => {
    if (status === 0 && is_relocation === 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "INVALID_REQUEST_STATUS",
        path: ["is_relocation"],
      })
    }
  })

export type GetEntitiesQueries = z.infer<typeof GetListEntitySchema> & {
  program_id?: number
}
export type UpdateStatusEntitiesRequest = z.infer<
  typeof UpdateStatusEntityRequestSchema
>

export type UpdateStatusVendorEntitiesRequest = z.infer<
  typeof UpdateStatusVendorEntityRequestSchema
>

export type EntityDTO = Selectable<WsEntities>

export type ListEntityDTO = {
  id: number
  name: string | null
  code: string | null
  status: number | null
  tag: string | null
  location: string
}

export type ColumnImportSchema = {
  EntityId: string
  IsVendor: string
  Status: string
  IsRelocation: string
}

export type ImportSchemaRequest = {
  EntityId: string | number | undefined
  IsVendor: string | number | undefined
  Status: string | number | undefined
  IsRelocation: string | number | undefined
}

export const ImportEntityRequestRowSchema = (COL: ColumnImportSchema) =>
  z
    .object({
      [COL.EntityId]: z.string().or(z.number()).optional(),
      [COL.IsVendor]: z.string().or(z.number()).optional(),
      [COL.Status]: z.string().or(z.number()).optional(),
      [COL.IsRelocation]: z.string().or(z.number()).optional(),
    })
    .transform((row) => ({
      EntityId: row[COL.EntityId],
      IsVendor: row[COL.IsVendor],
      Status: row[COL.Status],
      IsRelocation: row[COL.IsRelocation],
    }))

export const ImportEntityRequestSchema = (COL: ColumnImportSchema) =>
  z.array(ImportEntityRequestRowSchema(COL)).min(1, {
    message: "rows cannot be empty",
  })

export type EntityProgramDTO = Selectable<EntityWorkspaces>
