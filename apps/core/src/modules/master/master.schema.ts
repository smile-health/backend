import { Locations } from "@/common/infrastructure/database/types/db.js"
import { PaginationQueriesSchema } from "@smile/lib/types/paginate.js"
import { Selectable } from "kysely"
import { z } from "zod"

export const Pageable = PaginationQueriesSchema.extend({
  parent_id: z
    .string()
    .optional()
    .transform((val) => {
      if (val) {
        return val.split(",").map(Number)
      }
    }),
})

export type TLocations = Selectable<Locations>
export type TLocationPageable = z.infer<typeof Pageable> & {
  level?: number
}
