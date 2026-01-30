import { FLAG } from "@/common/constants/general"
import { Entities } from "@/common/infrastructure/database/types/db.js"
import { PaginationQueriesSchema } from "@smile-health/lib/types/paginate.js"
import { IdSchema } from "@smile-health/lib/types/param.js"
import { Selectable } from "kysely"
import z from "zod"

export const generalMultipleIdSchema = z
  .string()
  .transform((val) => val.split(",").filter((item) => item !== ""))

export const GetEntitiesParamsSchema = PaginationQueriesSchema.extend({
  keyword: z.string().optional(),
  id_satu_sehat: z
    .string()
    .refine(
      (val) =>
        val
          .split(",")
          .filter((item) => item !== "")
          .every((num) => !isNaN(Number(num))),
      {
        message: "INVALID_SATUSAHAT_ID_PARAM",
      }
    )
    .transform((val) => val.split(",").filter((item) => item !== ""))
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
    .transform((val) => val.split(",").filter((item) => item !== ""))
    .optional(),
  program_ids: z
    .string()
    .refine(
      (val) =>
        val
          .split(",")
          .filter((item) => item !== "")
          .every((num) => !isNaN(Number(num))),
      {
        message: "INVALID_PROGRAM_ID_PARAM",
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
  sort_by: z
    .enum(["name", "location", "tag", "code", "id_satu_sehat"], {
      message: "INVALID REQUEST SORT_BY",
    })
    .optional(),
  sort_type: z
    .enum(["asc", "desc"], { message: "INVALID REQUEST SORT_TYPE" })
    .optional(),
  is_asset: z
    .enum(["0", "1"], { message: "INVALID_IS_ASSET_PARAM" })
    .transform((val) => Number(val))
    .optional(),
  is_vendor: z.preprocess(Number, z.nativeEnum(FLAG)).optional(),
  entity_id: z.string().optional(),
})

export const EntityDto = z.object({
  id: z.number().optional(),
  code: z.string(),
  name: z.string(),
  entity_tag_id: z.number().nullish(),
  type: z.number(),
  status: z.number().optional(),
  address: z.string(),
  country: z.string().nullish(),
  province_id: z.string().nullish(),
  regency_id: z.string().nullish(),
  sub_district_id: z.string().nullish(),
  village_id: z.string().nullish(),
  postal_code: z.string().nullish(),
  lat: z.string().nullish(),
  lng: z.string().nullish(),
  is_puskesmas: z.number().optional(),
  is_vendor: z.number().optional(),
  created_by: z.number().nullish(),
  updated_by: z.number().nullish(),
  created_at: z.date().optional(),
  updated_at: z.date().optional(),
  integration_type: z.coerce.number().nullish(),
  external_properties: z.record(z.any()).nullish(),
  integration_client_id: z.number().optional(),
  id_satu_sehat: z.number().nullable().optional(),
})

export const EntityDtos = z.array(EntityDto)

export const numberToString = z
  .string()
  .or(z.number())
  .transform((val) => String(val))

export type ColumnImportSchema = {
  Name: string
  Code: string
  Address: string
  TypeId: string
  EntityTagId: string
  ProvinceId: string
  RegencyId: string
  SubDistrictId: string
  VillageId: string
  ProgramId: string
  PostalId: string
  Latitude: string
  Longitude: string
  Country: string
  idSatuSehat: string
}

export const ImportEntityRequestRowSchema = (COL: ColumnImportSchema) =>
  z
    .object({
      [COL.Name]: z.string(),
      [COL.Code]: numberToString,
      [COL.Address]: z.string(),
      [COL.TypeId]: IdSchema.or(z.number()),
      [COL.EntityTagId]: IdSchema.or(z.number()),
      [COL.ProvinceId]: IdSchema.optional().or(z.number()),
      [COL.RegencyId]: IdSchema.optional().or(z.number()),
      [COL.SubDistrictId]: IdSchema.optional().or(z.number()),
      [COL.VillageId]: IdSchema.optional().or(z.number()),
      [COL.ProgramId]: z
        .string()
        .optional()
        .or(z.number())
        .transform((val) => {
          if (!val) {
            return undefined
          }
          return val
            .toString()
            .split(";")
            .filter((item) => item !== "")
            .map((item) => Number(item))
        }),
      [COL.PostalId]: numberToString.optional(),
      [COL.Latitude]: numberToString.optional(),
      [COL.Longitude]: numberToString.optional(),
      [COL.Country]: z.string().optional(),
      [COL.idSatuSehat]: IdSchema.or(z.number()).optional(),
    })
    .transform(
      (row) =>
        ({
          Name: row[COL.Name],
          Code: row[COL.Code],
          Address: row[COL.Address],
          TypeId: row[COL.TypeId],
          EntityTagId: row[COL.EntityTagId],
          ProvinceId: row[COL.ProvinceId],
          RegencyId: row[COL.RegencyId],
          SubDistrictId: row[COL.SubDistrictId],
          VillageId: row[COL.VillageId],
          ProgramId: row[COL.ProgramId],
          PostalId: row[COL.PostalId],
          Latitude: row[COL.Latitude],
          Longitude: row[COL.Longitude],
          Country: row[COL.Country],
          Status: 1,
          idSatuSehat: row[COL.idSatuSehat]
            ? Number(row[COL.idSatuSehat])
            : undefined,
        }) as ImportEntityRequest
    )

export const ImportEntityRequestSchema = (COL: ColumnImportSchema) =>
  z.array(ImportEntityRequestRowSchema(COL)).min(1, {
    message: "rows cannot be empty",
  })

export type ImportEntityRequest = {
  Name: string
  Code: string
  Address: string
  TypeId: number
  EntityTagId: number
  ProvinceId?: number
  RegencyId?: number
  SubDistrictId?: number
  VillageId?: number
  ProgramId?: number[]
  PostalId?: string
  Latitude?: string
  Longitude?: string
  Country?: string
  Status: number
  idSatuSehat?: number
}

export const BasicEntityDto = EntityDto.pick({
  id: true,
  name: true,
  type: true,
  address: true,
}).extend({
  tag: z.string().nullish(),
})

export const CreateEntityRequest = EntityDto.pick({
  code: true,
  name: true,
  type: true,
  status: true,
  address: true,
  country: true,
  province_id: true,
  regency_id: true,
  sub_district_id: true,
  village_id: true,
  postal_code: true,
  lat: true,
  lng: true,
  entity_tag_id: true,
}).extend({
  program_ids: z.array(z.number(), { message: "validator.array" }).nullish(),
})

export const EntityTagDto = z.object({
  id: z.number(),
  title: z.string().nullable(),
})

export const EntityWorkspaceDto = z.object({
  id: z.number(),
  name: z.string(),
  key: z.string(),
})

export const EntityLocationDto = z.object({
  id: z.number(),
  name: z.string().nullable(),
  level: z.number().nullable(),
})

export const EntityResponse = EntityDto.extend({
  entity_tag: EntityTagDto.nullable().default(null),
  programs: z.array(EntityWorkspaceDto).nullable().default([]),
  locations: z.array(EntityLocationDto).nullable().default([]),
})

export const EntityId = z.object({ id: z.string() })

export const EntityWorkspaceSchema = z.object({
  entity_id: z.number().positive(),
  workspace_id: z.number().positive(),
})

export type TCreateEntityRequest = {
  code: string
  name: string
  type: number
  address: string
  entity_tag_id: number
  province_id?: string | null
  regency_id?: string | null
  sub_district_id?: string | null
  village_id?: string | null
  postal_code?: string
  lat?: string
  lng?: string
  program_ids?: number[] | null
  country?: string
  external_properties?: Record<string, any> | undefined
  status?: number
  integration_client_id?: number
  id_satu_sehat?: string | number | undefined | null
}

export type ListEntityDTO = {
  id: number
  name: string | null
  code: string | null
  type: number
  status: number
  entity_tag_id: number | null
  is_puskesmas: number
  is_vendor: number
  tag_id: number | null
  tag: string | null
  type_id: number | null
  type_name: string | null
  id_satu_sehat: string | null
  location: string
  province_id: string | number | null
  regency_id: string | number | null
  sub_district_id: string | number | null
  village_id: string | number | null
  province_name: string | null
  regency_name: string | null
  sub_district_name: string | null
  village_name: string | null
  province_level: number | null
  regency_level: number | null
  sub_district_level: number | null
  external_properties: Record<string, any> | undefined
  village_level: number | null
  integration_client_id: number | null
}

export type LocationsDTO = {
  id: number
  name: string
  level: number
}

export type TEntityIdRequest = z.infer<typeof EntityId>
export type TGetEntitiesParams = z.infer<typeof GetEntitiesParamsSchema>
export type GetEntitiesQueries = z.infer<typeof GetEntitiesParamsSchema>

export type TEntityResponse = z.infer<typeof EntityResponse>
export type TEntityTagResponse = z.infer<typeof EntityTagDto>
export type TEntityDto = z.infer<typeof EntityDto>
export type TEntity = Selectable<Entities>
export type ImportSets = {
  codeSet: Set<string>
  typeIdSet: Set<number>
  entityTagSet: Set<number>
  provinceSet: Set<number>
  regencySet: Set<number>
  subdistrictSet: Set<number>
  villageSet: Set<number>
  programSet: Set<number>
  idSatuSehatSet: Set<number>
}
export type EntityWorkspace = z.infer<typeof EntityWorkspaceSchema>
