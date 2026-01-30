import { PaginationQueriesSchema } from "@smile-health/lib/types/paginate.js"
import z from "zod"

export const GetListEntityVendorSchema = PaginationQueriesSchema.extend({
  is_relocation: z
    .enum(["0", "1"], {
      message: "Invalid is_relocation",
    })
    .transform((val) => Number(val))
    .optional(),
  activity_id: z
    .string()
    .transform((val) => Number(val))
    .refine((v) => !isNaN(v!), { message: "invalid activity_id" })
    .optional(),
})

export type GetEntitiesVendorsQueries = z.infer<
  typeof GetListEntityVendorSchema
>
