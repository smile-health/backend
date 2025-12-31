import { QueryParamsSchema } from "@/common/schemas/query-param.schema.js"
import { IdSchema } from "@smile/lib/types/param.js"
import { z } from "zod"

export const LocationQueryParamsSchema = QueryParamsSchema.and(
  z.object({
    exlcude_entity_type_center: z.boolean().optional(),
    material_is_stock_opname_mandatory: z.number().optional(),
    has_transaction_already: z.number().optional(),
  })
)

export const LocationItemDTOSchema = z
  .object({
    id: IdSchema,
    name: z.string(),
    type: IdSchema,
  })
  .extend({
    province_name: z.string().nullish(),
    regency_name: z.string().nullish(),
    entity_tag_name: z.string().nullish(),
  })

export const LocationDTOSchema = z.array(LocationItemDTOSchema)

/* Types */
export type LocationQueryParams = z.infer<typeof LocationQueryParamsSchema>

export type LocationItemDTO = z.infer<typeof LocationItemDTOSchema>
export type LocationDTO = z.infer<typeof LocationDTOSchema>
