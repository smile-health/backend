import { QueryParamsSchema } from "@/common/schemas/query-param.schema.js"
import { DateSchema, IdSchema } from "@smile-health/lib/types/param.js"
import { z } from "zod"

/* Schemas */
export const ActivitySchema = z.object({
  id: IdSchema,
  program_id: z.int(),
  name: z.string(),
  is_ordered_sales: z.int().nullish(),
  is_ordered_purchase: z.int().nullish(),
  created_by: z.int().nullish(),
  updated_by: z.int().nullish(),
  deleted_by: z.int().nullish(),
  created_at: DateSchema,
  updated_at: DateSchema,
  deleted_at: DateSchema.nullish(),
  protocol: z.string().nullish(),
  status: z.int().nullish(),
  code: z.string().nullish(),
})

export const ActivityQueryParamsSchema = z.intersection(
  QueryParamsSchema,
  z.object({
    name: z.string().nullish(),
    code: z.string().nullish(),
  })
)

export const ActivityItemDTOSchema = ActivitySchema.pick({
  id: true,
  name: true,
  code: true,
})

export const ActivityDTOSchema = z.array(ActivityItemDTOSchema)

/* Types */
export type Activity = z.infer<typeof ActivitySchema>

export type ActivityQueryParams = z.infer<typeof ActivityQueryParamsSchema>

export type ActivityItemDTO = z.infer<typeof ActivityItemDTOSchema>
export type ActivityDTO = z.infer<typeof ActivityDTOSchema>
