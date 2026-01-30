import { PaginationQueriesSchema } from "@smile-health/lib/types/paginate.js"
import { z } from "zod"

/* Filter Schema */
const ContractFilterSchema = z.object({
  commitment_id: z.coerce.number().optional(),
  is_available: z
    .union([
      z.literal(0),
      z.literal(1),
      z.literal("0").transform(() => 0),
      z.literal("1").transform(() => 1),
    ])
    .optional(),
})

export const GetListContractSchema =
  PaginationQueriesSchema.merge(ContractFilterSchema)

export type GetListContractQueries = z.infer<typeof GetListContractSchema>
