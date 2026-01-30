import { PaginationQueriesSchema } from "@smile-health/lib/types/paginate"
import { z } from "zod"

/* Query Params Schema */
export const GetTemperatureThresholdsQueryParamsSchema =
  PaginationQueriesSchema.extend({
    is_predefined: z
      .union([
        z.literal("0"),
        z.literal("1"),
        z.literal("2"),
        z.null(),
        z.undefined(),
      ])
      .transform((val) => {
        if (val === "0") return 0
        if (val === "1") return 1
        if (val === "2") return 2
        return null
      })
      .optional(),
  })

/* Query Params Type */
export type GetTemperatureThresholdsQueryParams = z.infer<
  typeof GetTemperatureThresholdsQueryParamsSchema
>
