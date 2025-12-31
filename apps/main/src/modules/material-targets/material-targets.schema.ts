import { PaginationQueriesSchema } from "@smile/lib/types/paginate.js"
import z from "zod"

export const MaterialTargetsPaginatedRequestSchema =
  PaginationQueriesSchema.extend({
    category: z
      .enum(["bias", "non_bias"], {
        message: "Category must be either bias or non_bias",
      })
      .optional()
      .or(z.literal("").transform(() => undefined)),
    type: z
      .enum(["primary", "additional"], {
        message: "Type must be either primary or additional",
      })
      .optional()
      .or(z.literal("").transform(() => undefined)),
  })

export type MaterialTargetsPaginatedRequestDTO = z.infer<
  typeof MaterialTargetsPaginatedRequestSchema
>
