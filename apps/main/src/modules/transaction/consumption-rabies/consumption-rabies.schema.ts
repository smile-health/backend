import { DateSchema } from "@smile/lib/types/param.js"
import z from "zod"

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

/*
 * Validation Rules
 */
const PatientSchema = z.object({
  identity_type: z.preprocess(preprocessNumber, PositiveIntSchema),
  identity_number: z.string(),
  phone_number: z.string().nullable(),
  vaccine_sequence: z.preprocess(preprocessNumber, PositiveIntSchema),
  other_sequences: z
    .array(
      z.object({
        vaccine_sequence: z.preprocess(preprocessNumber, PositiveIntSchema),
        actual_transaction_date: DateSchema,
      })
    )
    .optional(),
})

const ConsumptionMaterialSchema = z.object({
  material_id: z.preprocess(preprocessNumber, PositiveIntSchema),
  stock_id: z.preprocess(preprocessNumber, PositiveIntSchema),
  qty: z.number().optional(),
  close_vial: z.number().optional(),
  open_vial: z.number().optional(),
  identity_type: z.preprocess(preprocessNumber, PositiveIntSchema).optional(),
  identity_number: z.string().optional(),
  phone_number: z.string().nullish(),
  vaccine_type: z.preprocess(preprocessNumber, PositiveIntSchema).optional(),
  vaccine_method: z.preprocess(preprocessNumber, PositiveIntSchema).optional(),
  patients: z.array(PatientSchema).optional(),
})

const ConsumptionSchema = z.object({
  entity_id: z.preprocess(preprocessNumber, PositiveIntSchema),
  activity_id: z.preprocess(preprocessNumber, PositiveIntSchema),
  entity_activity_id: z.preprocess(preprocessNumber, PositiveIntSchema),
  customer_id: z.preprocess(preprocessNumber, PositiveIntSchema),
  actual_transaction_date: DateSchema,
})

/*
 * Use Case - Request
 */
export const ConsumptionRequestSchema = ConsumptionSchema.extend({
  materials: z.array(ConsumptionMaterialSchema).nonempty().min(1),
})

/*
 * DTO - Request
 */
export type ConsumptionRequest = z.infer<typeof ConsumptionRequestSchema>
export type RabiesPatientDTO = z.infer<typeof PatientSchema>
