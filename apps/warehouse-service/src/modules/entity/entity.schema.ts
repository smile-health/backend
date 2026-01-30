import { QueryParamsSchema } from "@/common/schemas/query-param.schema.js"
import { DateSchema, IdSchema } from "@smile-health/lib/types/param.js"
import { z } from "zod"

/* Schemas */
export const EntitySchema = z.object({
  id: IdSchema,
  name: z.string(),
  type: IdSchema,
  entity_tag_id: IdSchema,
  code: z.string().nullish(),
  global_id: IdSchema,
  program_id: IdSchema,
  status: z.number().int().nullish(),
  id_satu_sehat: IdSchema.nullish(),
  address: z.string().nullish(),
  country: z.string().nullish(),
  village_id: z.string().nullish(),
  province_id: z.string().nullish(),
  regency_id: z.string().nullish(),
  sub_district_id: z.string().nullish(),
  postal_code: z.string().nullish(),
  lat: z.string().nullish(),
  lng: z.string().nullish(),
  is_puskesmas: z.number().int(),
  is_vendor: z.number().int().nullish(),
  created_by: z.number().int().nullish(),
  updated_by: z.number().int().nullish(),
  created_at: DateSchema,
  updated_at: DateSchema,
  deleted_at: DateSchema.nullish(),
})

export const EntityQueryParamsSchema = z.intersection(
  QueryParamsSchema,
  z.object({
    exlcude_entity_type_center: z.boolean().optional(),
    material_is_stock_opname_mandatory: z.number().optional(),
    has_transaction_already: z.number().optional(),
  })
)

export const EntityItemDTOSchema = EntitySchema.pick({
  id: true,
  name: true,
  type: true,
  province_id: true,
  regency_id: true,
}).extend({
  province_name: z.string().nullish(),
  regency_name: z.string().nullish(),
  entity_tag_id: z.number().int().nullish(),
  entity_tag_name: z.string().nullish(),
})

export const EntityDTOSchema = z.array(EntityItemDTOSchema)

/* Types */
export type Entity = z.infer<typeof EntitySchema>

export type EntityQueryParams = z.infer<typeof EntityQueryParamsSchema>

export type EntityItemDTO = z.infer<typeof EntityItemDTOSchema>
export type EntityDTO = z.infer<typeof EntityDTOSchema>
