import { PaginationQueriesSchema } from "@smile-health/lib/types/paginate.js"
import {
  PqsCodes,
  PqsTypes,
} from "@/common/infrastructure/database/types/db.js"
import { z } from "zod"
import { Selectable } from "kysely"

// Base schema for WHO PQS entity (minimal, can be extended)
export const WhoPqsSchema = z.object({
  id: z.number().positive(),
  code: z.string().min(1).max(255),
  pqs_type_id: z.number().positive(),
  cceigat_description_id: z
    .number()
    .positive()
    .nullish()
    .optional()
    .default(null),
  created_by: z.number().positive(),
  updated_by: z.number().positive(),
  deleted_by: z.number().positive().nullish(),
  created_at: z.date(),
  updated_at: z.date(),
  deleted_at: z.date().nullish(),
})

/*Rquest Body Schema */
export const CreateWhoPqsSchema = WhoPqsSchema.pick({
  code: true,
  pqs_type_id: true,
  cceigat_description_id: true,
}).extend({
  net_capacity5: z.number().positive().nullish().optional().default(null),
  net_capacityMin20: z.number().positive().nullish().optional().default(null),
  net_capacityMin86: z.number().positive().nullish().optional().default(null),
})

export const UpdateWhoPqsSchema = WhoPqsSchema.pick({
  code: true,
  pqs_type_id: true,
  cceigat_description_id: true,
}).extend({
  net_capacity5: z.number().positive().nullish().optional().default(null),
  net_capacityMin20: z.number().positive().nullish().optional().default(null),
  net_capacityMin86: z.number().positive().nullish().optional().default(null),
})

// Query params for listing WHO PQS
export const GetWhoPqsQueryParamSchema = PaginationQueriesSchema.extend({
  sort_by: z
    .enum(["code", "updated_at"], {
      message: "INVALID REQUEST SORT_BY",
    })
    .default("updated_at"),
  sort_type: z
    .enum(["asc", "desc"], { message: "INVALID REQUEST SORT_TYPE" })
    .default("desc"),
})

/* DTO */
export const WhoPqsDTOSchema = WhoPqsSchema.omit({
  id: true,
  created_by: true,
  deleted_by: true,
  created_at: true,
  deleted_at: true,
})

/* Request Body Type */
export type CreateWhoPqsRequest = z.infer<typeof CreateWhoPqsSchema>
export type UpdateWhoPqsRequest = z.infer<typeof UpdateWhoPqsSchema>

export type GetWhoPqsQueryParams = z.infer<typeof GetWhoPqsQueryParamSchema>
export type WhoPqsDTO = z.infer<typeof WhoPqsDTOSchema>
export type RowType = string | number | Date | null

export type PqsCodeSchema = Selectable<PqsCodes>
export type PqsTypeSchema = Selectable<PqsTypes>
