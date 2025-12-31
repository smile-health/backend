import { PaginationQueriesSchema } from "@smile/lib/types/paginate.js"
import moment from "moment"
import z from "zod"

export type InsertEntityActivityDateDTO = {
  entity_id: number
  activity_id: number
  start_date: Date | null | undefined
  end_date: Date | null | undefined
  created_at: Date
  updated_at: Date
  deleted_at?: Date
}

export type UpdateEntityActivityDateDTO = {
  id?: number
  activity_id: number
  start_date?: Date | null
  end_date?: Date | null
}

export const GetListEntityActivitySchema = PaginationQueriesSchema

export const IsOngoingSchema = z.object({
  is_ongoing: z
    .string()
    .optional()
    .transform((val) => (val ? Number(val) : 0)),
  is_ordered_sales: z
    .enum(["0", "1"])
    .transform((val) => Number(val))
    .optional(),
  is_ordered_purchase: z
    .enum(["0", "1"])
    .transform((val) => Number(val))
    .optional(),
})

export const GetListEntityActivityAdditionalSchema = IsOngoingSchema.merge(
  PaginationQueriesSchema
)

export const SubmitEntityActivityRequestSchema = z.object({
  entity_id: z.number({ message: "ID IS REQUIRED" }).nonnegative(),
  activities: z.array(
    z.object({
      id: z.number().int().nonnegative().optional(),
      activity_id: z.number().nonnegative(),
      start_date: z
        .string()
        .refine(
          (val) => {
            const isValid = moment(val).isValid()
            return isValid
          },
          {
            message: "INVALID START DATE PARAM",
          }
        )
        .transform((val) => new Date(val))
        .nullable()
        .optional(),
      end_date: z
        .string()
        .refine(
          (val) => {
            const isValid = moment(val).isValid()
            return isValid
          },
          {
            message: "INVALID END DATE PARAM",
          }
        )
        .transform((val) => new Date(val))
        .nullable()
        .optional(),
    })
  ),
})

export type GetEntityActivitiesQueries = z.infer<
  typeof GetListEntityActivitySchema
>
export type SubmitEntityActivitiesRequest = z.infer<
  typeof SubmitEntityActivityRequestSchema
>

export type GetEntityActivitiesAdditionalQueries = z.infer<
  typeof GetListEntityActivityAdditionalSchema
>
