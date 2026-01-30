import { PaginationQueriesSchema } from "@smile-health/lib/types/paginate.js"
import z from "zod"

export const GetListVillageSchema = PaginationQueriesSchema.extend({
  sub_district_id: z
    .string({ message: "SUB_DISTRICT_ID_IS_REQUIRED" })
    .refine(
      (val) =>
        val
          .split(",")
          .filter((item) => item !== "")
          .every((num) => !isNaN(Number(num))),
      {
        message: "INVALID_SUB_DISTRICT_ID_PARAM",
      }
    )
    .transform((val) => val.split(",").filter((item) => item !== "")),
})

export type GetVillagesQueries = z.infer<typeof GetListVillageSchema>
