import { QueryParamsSchema } from "@/common/schemas/query-param.schema.js"
import { DateSchema, IdSchema } from "@smile-health/lib/types/param.js"
import { z } from "zod"

/* Schemas */
export const RegionSchema = z.object({
  id: IdSchema,
  name: z.string(),
  type: IdSchema,
  parent_id: IdSchema.nullish(),
  lat: z.string().nullish(),
  lng: z.string().nullish(),
  level: z.number().int().nullish(),
  created_at: DateSchema,
  updated_at: DateSchema,
})

export const RegionQueryParamsSchema = QueryParamsSchema

export const RegionItemDTOSchema = RegionSchema.pick({
  id: true,
  name: true,
  type: true,
})

export const RegionDTOSchema = z.array(RegionItemDTOSchema)

/* Types */
export type Region = z.infer<typeof RegionSchema>

export type RegionQueryParams = z.infer<typeof RegionQueryParamsSchema>

export type RegionItemDTO = z.infer<typeof RegionItemDTOSchema>
export type RegionDTO = z.infer<typeof RegionDTOSchema>
