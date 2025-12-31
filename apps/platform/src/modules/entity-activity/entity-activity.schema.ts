import { PaginationQueriesSchema } from "@smile/lib/types/paginate.js"
import moment from "moment"
import z from "zod"

export type InsertEntityActivityDateDTO = {
  entity_id: number
  activity_id: number
  join_date: Date | null | undefined
  end_date: Date | null | undefined
  created_at: Date
  updated_at: Date
  deleted_at?: Date
}

export type UpdateEntityActivityDateDTO = {
  activity_id: number
  join_date?: Date | null
  end_date?: Date | null
}

export const GetListEntityActivitySchema = PaginationQueriesSchema

export const SubmitEntityActivityRequestSchema = z.object({
  entity_id: z.number({ message: "ID IS REQUIRED" }).nonnegative(),
  activities: z.array(
    z.object({
      activity_id: z.number().nonnegative(),
      join_date: z
        .string()
        .refine(
          (val) => {
            const isValid = moment(val).isValid()
            return isValid
          },
          {
            message: "INVALID JOIN DATE PARAM",
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
