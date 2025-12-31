import { QueryParamSchema } from "@/common/schemas/query-param.schema.js"
import { IdsSchema } from "@smile/lib/types/param.js"
import { z } from "zod"

export const UserActivitySchema = QueryParamSchema.and(
  z.object({
    is_customer_activity: z
      .string()
      .refine((val) => ["0", "1"].includes(val))
      .transform((val) => parseInt(val, 10))
      .default("0"),
    customer_tag_ids: IdsSchema.optional(),
  })
)

export type UserActivityQueryParams = z.infer<typeof UserActivitySchema> & {
  program_id?: number
  userActivityType?: number
  current_date?: string
  customer_id?: number
  customer_entity_tag_id?: number
}

export interface UserActivityDTO {
  activity_id?: number
  activity_name?: string
  entity_id?: number
  entity_name?: string
  customer_id?: number
  customer_name?: string
  material_name?: string
  province_name?: string
  regency_name?: string
  count?: number
  active_transaction?: number
  pct_active_entity?: number
  pct_non_active_entity?: number
  active_entity?: number
  non_active_entity?: number
  total_entity?: number
  date?: string
}

export interface ActivityByEntityDTO {
  id?: number
  name?: string
  customer_id?: number
  customer_name?: string
  activity_id?: string
  activity_name?: string
  province_name?: string
  regency_name?: string
  material_name?: string
  total_active_days?: number
  total_inactive_days?: number
  total_frequency?: number
  average_frequency?: number
  overview?: { [key: string]: number }[]
}

export const USER_ACTIVITY_TYPE = {
  DATES: 1,
  OVERVIEW: 2,
  BY_ENTITY: 3,
  ALL: 4,
  CALCULATE_ENTITY: 5,
}
