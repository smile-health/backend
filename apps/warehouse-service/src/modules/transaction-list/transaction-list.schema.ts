import { PaginationQueriesSchema } from "@smile/lib/types/paginate.js"
import z from "zod"

const optionalNumber = z
  .string()
  .or(z.number())
  .nullable()
  .optional()
  .transform((val) => (val ? Number(val) : null))

export const TransactionListPaginatedRequestSchema =
  PaginationQueriesSchema.extend({
    programId: optionalNumber,
    activity_id: optionalNumber,
    material_type_id: optionalNumber,
    parent_material_id: optionalNumber,
    material_id: optionalNumber,
    transaction_type_id: optionalNumber,
    transaction_reason_id: optionalNumber,
    order_type: z.string().nullable().optional(),
    entity_tag_id: optionalNumber,
    vendor_id: optionalNumber,
    province_id: optionalNumber,
    regency_id: optionalNumber,
    customer_entity_tag_id: optionalNumber,
    companion_entity_id: optionalNumber,
    entity_id: optionalNumber,
    start_date: z.string().nullable().optional(),
    end_date: z.string().nullable().optional(),
    has_order: z.string().nullable().optional(),
  })

export type TransactionListPaginatedRequestDTO = z.infer<
  typeof TransactionListPaginatedRequestSchema
>
