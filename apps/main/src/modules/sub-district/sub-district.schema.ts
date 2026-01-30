import { PaginationQueriesSchema } from "@smile-health/lib/types/paginate.js"
import z from "zod"

export const GetListSubDistrictSchema = PaginationQueriesSchema.extend({
  regency_id: z
    .string({ message: "REGENCY_ID_IS_REQUIRED" })
    .refine(
      (val) =>
        val
          .split(",")
          .filter((item) => item !== "")
          .every((num) => !isNaN(Number(num))),
      {
        message: "INVALID_REGENCY_ID_PARAM",
      }
    )
    .transform((val) => val.split(",").filter((item) => item !== "")),
})

export type GetSubDistrictsQueries = z.infer<typeof GetListSubDistrictSchema>
