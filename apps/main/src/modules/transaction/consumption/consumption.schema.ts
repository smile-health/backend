import { DateSchema } from "@smile-health/lib/types/param.js"
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
  name: z.string().optional(),
  phone_number: z.string().nullable(),
  vaccine_sequence: z.preprocess(preprocessNumber, PositiveIntSchema.optional()),
  other_sequences: z
    .array(
      z.object({
        vaccine_sequence: z.preprocess(preprocessNumber, PositiveIntSchema),
        actual_transaction_date: DateSchema.optional().nullable(),
      })
    )
    .optional(),
  gender: z.number().int().optional().nullable(),
  birth_date: DateSchema.optional().nullable(),
  marital_status: z.number().int().optional().nullable(),
  religion_id: z.number().int().optional().nullable(),
  ethnic_id: z.number().int().optional().nullable(),
  residential_address: z.string().optional().nullable(),
  education_id: z.number().int().optional().nullable(),
  occupation_id: z.number().int().optional().nullable(),
  address: z.string().optional().nullable(),
  province_id: z.number().int().optional().nullable(),
  city_id: z.number().int().optional().nullable(),
  regency_id: z.number().int().optional().nullable(),
  subdistrict_id: z.number().int().optional().nullable(),
  village_id: z.number().int().optional().nullable(),
  pos_code: z.string().optional().nullable(),
  rt: z.string().optional().nullable(),
  rw: z.string().optional().nullable(),
  residential_province_id: z.number().int().optional().nullable(),
  residential_regency_id: z.number().int().optional().nullable(),
  residential_subdistrict_id: z.number().int().optional().nullable(),
  residential_village_id: z.number().int().optional().nullable(),
  reaction_id: z.number().int().optional().nullable(),
  other_reaction: z.string().optional().nullable(),
  is_diagnose_before: z.number().int().optional().nullable(),
  diagnosis_date: z.date().optional().nullable(),
  month_before: z.number().int().optional().nullable(),
  year_before: z.number().int().optional().nullable(),
  received_medicine: z.number().int().optional().nullable(),
  received_vaccine: z.number().int().optional().nullable(),
  notes: z.string().optional().nullable(),
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

export type ConsumptionMaterialRequestSchema = z.infer<typeof ConsumptionMaterialSchema>

/*
 * DTO - Request
 */
export type ConsumptionRequest = z.infer<typeof ConsumptionRequestSchema>
export type PatientRequest = z.infer<typeof PatientSchema>
