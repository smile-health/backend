import { QueryParamsSchema } from "@/common/schemas/query-param.schema.js"
import { DateSchema, IdSchema } from "@smile-health/lib/types/param.js"
import { z } from "zod"

/* Schemas */
export const EntityTagSchema = z.object({
  id: IdSchema,
  title: z.string().nullish(),
  created_at: DateSchema,
  updated_at: DateSchema,
  deleted_at: DateSchema.nullish(),
  integration_type: z.number().int().nullish(),
  external_properties: z.string().nullish(),
  is_open_vial: z.number().int().nullish(),
  ingested_at: DateSchema,
  version: z.number().int(),
})

export const EntityTagQueryParamsSchema = QueryParamsSchema

export const EntityTagItemDTOSchema = EntityTagSchema.pick({
  id: true,
  title: true,
})

export const EntityTagDTOSchema = z.array(EntityTagItemDTOSchema)

/* Types */
export type EntityTag = z.infer<typeof EntityTagSchema>

export type EntityTagQueryParams = z.infer<typeof EntityTagQueryParamsSchema>

export type EntityTagItemDTO = z.infer<typeof EntityTagItemDTOSchema>
export type EntityTagDTO = z.infer<typeof EntityTagDTOSchema>
