import { KFA_LEVEL_ID } from "@/common/constants/material.js"
import { WsBatches } from "@/common/infrastructure/database/types/db.js"
import { PaginationQueriesSchema } from "@smile-health/lib/types/paginate.js"
import { Selectable } from "kysely"
import { z } from "zod"

export type CreateBatchyDTO = Selectable<Omit<WsBatches, "id">>
export type BatchyDTO = Selectable<WsBatches>

export const getListBatchSchema = PaginationQueriesSchema.extend({
  material_ids: z.string().optional().transform((val) => {
    if (!val) return []
    return val.split(",").map(Number).filter(id => !isNaN(id))
  }),
  material_level_id: z.preprocess(
    (val) => (typeof val === 'string' ? Number(val) : val),
    z.nativeEnum(KFA_LEVEL_ID)
  ).default(KFA_LEVEL_ID.VARIANT),
})

export type GetListBatchQueries = z.infer<typeof getListBatchSchema>
