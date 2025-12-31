import { PaginationQueriesSchema } from "@smile/lib/types/paginate.js"
import { z } from "zod"

/*
 * Schema
 */
const preprocessNumber = (value: unknown) => {
  if (value === null || value === "") return undefined
  if (typeof value === "string") return parseInt(value, 10)
  if (typeof value === "number") return value
  return undefined
}
const PositiveIntSchema = z.number().int().positive()
const NonNegativeIntSchema = z.number().int().nonnegative()

/*
 * Use Case - Request
 */
const ReasonActionSchema = z.object({
  id: z.preprocess(preprocessNumber, PositiveIntSchema),
})

const ReconciliationItemSchema = z.object({
  reconciliation_category: z.preprocess(preprocessNumber, PositiveIntSchema),
  recorded_qty: z.preprocess(preprocessNumber, NonNegativeIntSchema),
  actual_qty: z.preprocess(preprocessNumber, NonNegativeIntSchema),
  reasons: z.array(ReasonActionSchema),
  actions: z.array(ReasonActionSchema),
})

export const CreateReconciliationSchema = z.object({
  entity_id: z.preprocess(preprocessNumber, PositiveIntSchema),
  activity_id: z.preprocess(preprocessNumber, PositiveIntSchema),
  start_date: z.string(),
  end_date: z.string(),
  material_id: z.preprocess(preprocessNumber, PositiveIntSchema),
  items: z.array(ReconciliationItemSchema).nonempty(),
})

export const GetGenerateReconciliationSchema = z.object({
  entity_id: z.preprocess(preprocessNumber, PositiveIntSchema),
  activity_id: z.preprocess(preprocessNumber, PositiveIntSchema),
  start_date: z.string(),
  end_date: z.string(),
  material_id: z.preprocess(preprocessNumber, PositiveIntSchema),
})

export const GetListReconciliationSchema = PaginationQueriesSchema.extend({
  activity_id: z
    .string()
    .transform((val) => Number(val))
    .refine((v) => !isNaN(v!), { message: "invalid activity_id" })
    .optional(),
  created_from: z.string().optional(),
  created_to: z.string().optional(),
  start_date: z.string().date().optional(),
  end_date: z.string().date().optional(),
  entity_id: z
    .string()
    .transform((val) => Number(val))
    .refine((v) => !isNaN(v!), { message: "invalid entity_id" })
    .optional(),
  entity_tag_id: z
    .string()
    .transform((val) => Number(val))
    .refine((v) => !isNaN(v!), { message: "invalid entity_tag_id" })
    .optional(),
  material_id: z
    .string()
    .transform((val) => Number(val))
    .refine((v) => !isNaN(v!), { message: "invalid material_id" })
    .optional(),
  parent_material_id: z
    .string()
    .transform((val) => Number(val))
    .refine((v) => !isNaN(v!), { message: "invalid material_id" })
    .optional(),
  material_type_id: z
    .string()
    .transform((val) => Number(val))
    .refine((v) => !isNaN(v!), { message: "invalid material_type_id" })
    .optional(),
  province_id: z
    .string()
    .transform((val) => Number(val))
    .refine((v) => !isNaN(v!), { message: "invalid province_id" })
    .optional(),
  regency_id: z
    .string()
    .transform((val) => Number(val))
    .refine((v) => !isNaN(v!), { message: "invalid regency_id" })
    .optional(),
})

/*
 * DTO - Request
 */
export type ListReconciliationItemDTO = {
  id: number
  reconciliation_id: number
  actual_qty: number | null
  recorded_qty: number | null
  reconciliation_category: number
  reconciliation_category_label: string
}

export type ListReconciliationItemReasonActionDTO = {
  reconciliation_item_id: number | null
  reconciliation_reason_id: number | null
  reconciliation_reason_title: string | null
  reconciliation_action_id: number | null
  reconciliation_action_title: string | null
}

export type CreateReconciliationDTO = z.infer<typeof CreateReconciliationSchema>

export type GetGenerateReconciliationDTO = z.infer<
  typeof GetGenerateReconciliationSchema
>

export type GetListReconciliationQueries = z.infer<
  typeof GetListReconciliationSchema
>
