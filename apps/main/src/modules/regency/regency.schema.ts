import { PaginationQueriesSchema } from "@smile-health/lib/types/paginate.js"
import z from "zod"

export const GetListRegencySchema = PaginationQueriesSchema.extend({
  province_id: z
    .string({ message: "PROVINCE_ID_IS_REQUIRED" })
    .refine(
      (val) =>
        val
          .split(",")
          .filter((item) => item !== "")
          .every((num) => !isNaN(Number(num))),
      {
        message: "INVALID_PROVINCE_ID_PARAM",
      }
    )
    .transform((val) => val.split(",").filter((item) => item !== "")),
})

export type GetRegenciesQueries = z.infer<typeof GetListRegencySchema>
