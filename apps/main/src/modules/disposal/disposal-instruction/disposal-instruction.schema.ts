import { PaginationQueriesSchema } from "@smile-health/lib/types/paginate.js"
import { IdSchema, OptionalIdSchema } from "@smile-health/lib/types/param.js"
import { z } from "zod"

const DisposalInstructionItemSchema = z
  .object({
    material_id: IdSchema.or(z.number()),
    stock_id: IdSchema.or(z.number()),
    transaction_reason_id: IdSchema.or(z.number()),
    disposal_discard_qty: z.number().min(0).optional(),
    disposal_received_qty: z.number().min(0).optional(),
    quantity: z.number().min(0).optional(),
    batch_number: z.string().optional(),
  })
  .refine(
    (data) => {
      const hasNewFields =
        data.disposal_discard_qty !== undefined ||
        data.disposal_received_qty !== undefined
      const hasOldField = data.quantity !== undefined

      return hasNewFields !== hasOldField || (!hasNewFields && !hasOldField)
    },
    {
      message:
        "Must provide either disposal_discard_qty/disposal_received_qty or quantity (but not both)",
      path: ["disposal_discard_qty"],
    }
  )
const DisposalStockSchema = z.object({
  discard_qty: z.number().min(0).optional(),
  received_qty: z.number().min(0).optional(),
  disposal_stock_id: IdSchema.or(z.number()),
  transaction_reasons: z.object({
    id: IdSchema.or(z.number()),
  }),
})

const StockSchema = z.object({
  batch_id: IdSchema.or(z.number()).optional().nullable(),
  disposal_stocks: z.array(DisposalStockSchema).min(1),
})

const DisposalItemSchema = z.object({
  material_id: IdSchema.or(z.number()),
  stocks: z.array(StockSchema).min(1),
})

export const CreateDisposalInstructionSchema = z.object({
  activity_id: IdSchema.or(z.number()),
  customer_id: IdSchema.or(z.number()),
  instruction_type_id: IdSchema.or(z.number()),
  bast_no: z.string().min(1, "BAST No is required"),
  disposal_comments: z.string().max(255).optional(),
  disposal_items: z.array(DisposalItemSchema).min(1),
})

// Keep the old schema for backward compatibility
const OldDisposalInstructionItemSchema = z
  .object({
    material_id: IdSchema.or(z.number()),
    stock_id: IdSchema.or(z.number()),
    transaction_reason_id: IdSchema.or(z.number()),
    disposal_discard_qty: z.number().min(0).optional(),
    disposal_received_qty: z.number().min(0).optional(),
    quantity: z.number().min(0).optional(),
    batch_number: z.string().optional(),
  })
  .refine(
    (data) => {
      const hasNewFields =
        data.disposal_discard_qty !== undefined ||
        data.disposal_received_qty !== undefined
      const hasOldField = data.quantity !== undefined

      return hasNewFields !== hasOldField || (!hasNewFields && !hasOldField)
    },
    {
      message:
        "Must provide either disposal_discard_qty/disposal_received_qty or quantity (but not both)",
      path: ["disposal_discard_qty"],
    }
  )

export const OldCreateDisposalInstructionSchema = z.object({
  entity_id: IdSchema.or(z.number()),
  activity_id: IdSchema.or(z.number()),
  disposal_instruction_type_id: IdSchema.or(z.number()),
  device_type: z.number().optional(),
  report_number: z.string().min(1, "Report number (BAST No) is required"),
  items: z.array(OldDisposalInstructionItemSchema).min(1),
  comments: z.array(z.string()).optional(),
})

export const DisposalInstructionListPaginatedRequestSchema =
  PaginationQueriesSchema.extend({
    bast_no: z.string().optional(),
    instruction_type: OptionalIdSchema.nullish(),
    from_date: z.string().optional(),
    to_date: z.string().optional(),
    activity_id: OptionalIdSchema.nullish(),
    entity_province_id: OptionalIdSchema.nullish(),
    entity_city_id: OptionalIdSchema.nullish(),
    entity_id: OptionalIdSchema.nullish(),
    entity_tag_id: OptionalIdSchema.nullish(),
  })

export const DisposalInstructionIdParamsSchema = z.object({
  id: IdSchema,
})

export const CreateDisposalInstructionCommentSchema = z.object({
  comment: z
    .string()
    .min(1, "Comment is required")
    .max(255, "Comment cannot exceed 255 characters"),
})

export type CreateDisposalInstructionCommentRequest = z.infer<
  typeof CreateDisposalInstructionCommentSchema
>

export const DisposalInstructionTypesListPaginatedRequestSchema =
  PaginationQueriesSchema.extend({
    page: z.string().optional(),
    paginate: z.string().optional(),
  })

export type DisposalInstructionTypesListPaginatedRequestDTO = z.infer<
  typeof DisposalInstructionTypesListPaginatedRequestSchema
>

export type CreateDisposalInstructionRequest = z.infer<
  typeof CreateDisposalInstructionSchema
>
export type DisposalInstructionListPaginatedRequestDTO = z.infer<
  typeof DisposalInstructionListPaginatedRequestSchema
>
export type DisposalInstructionIdParams = z.infer<
  typeof DisposalInstructionIdParamsSchema
>
