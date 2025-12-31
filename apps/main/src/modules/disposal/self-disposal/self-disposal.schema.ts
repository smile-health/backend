import { PaginationQueriesSchema } from "@smile/lib/types/paginate.js"
import { OptionalIdSchema, OptionalIdsSchema } from "@smile/lib/types/param.js"
import { IdSchema } from "@smile/lib/types/param.js"
import { z } from "zod"

const DisposalItemSchema = z.object({
  disposal_stock_id: IdSchema.or(z.number()),
  transaction_reason_id: IdSchema.or(z.number()),
  disposal_discard_qty: z.number(),
  disposal_received_qty: z.number(),
})

export const SelfDisposalSchema = z.object({
  entity_id: IdSchema.or(z.number()),
  activity_id: IdSchema.or(z.number()),
  report_number: z.string().optional(),
  comment: z.string().optional(),
  disposal_method_id: z.number(),
  disposal_items: z.array(DisposalItemSchema).min(1),
})

export const SelfDisposalListPaginatedRequestSchema =
  PaginationQueriesSchema.extend({
    keyword: z.string().optional(),
    entity_id: OptionalIdSchema.nullish(),
    material_id: OptionalIdsSchema.nullish(),
    activity_id: OptionalIdSchema.nullish(),
    disposal_method_id: IdSchema.or(z.number()).optional(),
    disposal_transaction_type_id: IdSchema.or(z.number()).optional(),
    start_date: z.string().optional(),
    end_date: z.string().optional(),
    transaction_reason_id: IdSchema.or(z.number()).optional(),
    entity_tag_id: IdSchema.or(z.number()).optional(),
    province_id: IdSchema.or(z.number()).optional(),
    regency_id: IdSchema.or(z.number()).optional(),
    material_type_id: IdSchema.or(z.number()).optional(),
    material_level_id: IdSchema.or(z.number()).optional(),
  })

export type SelfDisposalRequest = z.infer<typeof SelfDisposalSchema>
export type SelfDisposalListPaginatedRequestDTO = z.infer<
  typeof SelfDisposalListPaginatedRequestSchema
>
