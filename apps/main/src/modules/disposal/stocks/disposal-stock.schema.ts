import { PaginationQueriesSchema } from "@smile/lib/types/paginate.js"
import { OptionalIdSchema, OptionalIdsSchema } from "@smile/lib/types/param.js"
import z from "zod"
import moment from "moment"

// Date validation schema
const dateSchema = z
  .string()
  .refine(
    (v) => {
      if (!v) return true
      return moment(v).isValid()
    },
    { message: "validator.date" }
  )
  .transform((val) => moment(val).format("YYYY-MM-DD HH:mm:ss"))
  .nullish()

export const GetDisposalStocksQueriesSchema = PaginationQueriesSchema.extend({
  entity_id: OptionalIdSchema.nullish(),
  material_id: OptionalIdsSchema.nullish(),
  activity_id: OptionalIdSchema.nullish(),
  keyword: z.string().nullish(),
  batch_ids: OptionalIdsSchema.nullish(),
  expired_from: dateSchema.nullish(),
  expired_to: dateSchema.nullish(),
  province_id: OptionalIdSchema.nullish(),
  regency_id: OptionalIdSchema.nullish(),
  entity_tag_id: OptionalIdSchema.nullish(),
  paginate: OptionalIdSchema.default("10").transform(Number).nullish(),
  page: OptionalIdSchema.default("1").transform(Number).nullish(),
  material_level_id: OptionalIdSchema.default("2").transform(Number).nullish(),
  only_have_qty: z
    .enum(["0", "1"], { message: "validator.only_0_or_1" })
    .default("1")
    .transform(Number)
    .nullish(),
  material_type_id: OptionalIdSchema.nullish(),
})

export type GetDisposalStocksQueries = z.infer<
  typeof GetDisposalStocksQueriesSchema
>
