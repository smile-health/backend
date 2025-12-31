import { PaginationQueriesSchema } from "@smile/lib/types/paginate.js"
import { IdParamsSchema, DateSchema } from "@smile/lib/types/param.js"
import z from "zod"

export const GetNotificationsQueryParamsSchema = PaginationQueriesSchema.extend(
  {
    province_id: z.coerce.number().optional(),
    city_id: z.coerce.number().optional(),
    health_center_id: z.coerce.number().optional(),
    receive_date: DateSchema.optional(),
    received_end_date: DateSchema.optional(),
    notification_type: z.string().optional(),
    entity_tag_ids: z.preprocess(
      (val) => {
        if (typeof val === "string") {
          return val.split(",").map((str) => Number(str))
        }
        return undefined
      },
      z.array(z.number().refine((n) => !isNaN(n))).optional()
    ),
    program_ids: z.preprocess(
      (val) => {
        if (typeof val === "string") {
          return val.split(",").map((str) => Number(str))
        }
        return undefined
      },
      z.array(z.number().refine((n) => !isNaN(n))).optional()
    ),
    limit: z.coerce.number().optional(),
    event_code: z.string().optional(),
  }
)

export const GetNotificationParamSchema = IdParamsSchema

export const GetNotificationsTypesPaginationSchema = PaginationQueriesSchema

export type GetNotificationsQueryParams = z.infer<
  typeof GetNotificationsQueryParamsSchema
>

export type GetNotificationsTypesPagination = z.infer<
  typeof GetNotificationsTypesPaginationSchema
>
