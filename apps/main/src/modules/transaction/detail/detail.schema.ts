import { z } from "zod"

const preprocessNumber = (value: unknown) => {
  if (value === null || value === "") return undefined
  if (typeof value === "string") return parseInt(value, 10)
  if (typeof value === "number") return value
  return undefined
}

/*
 * Request
 */
export const TransactionDetailRequestSchema = z.object({
  id: z.preprocess(preprocessNumber, z.number().int().positive()),
})

export type TransactionDetailRequestDTO = z.infer<
  typeof TransactionDetailRequestSchema
>

/*
 * Response
 */
export const TransactionDetailResponseSchema = z.object({
  consumption_id: z.number(),
  protocol: z.object({
    id: z.number(),
    name: z.string(),
    is_kipi: z.boolean(),
    is_medical_history: z.boolean(),
  }),
  transaction: z.object({
    activity_name: z.string(),
    material_name: z.string(),
    batch_code: z.string(),
    device: z.string(),
    manufacturer: z.string(),
    production_date: z.string(),
    expired_date: z.string(),
    actual_transaction_date: z.string(),
    entity_name: z.string(),
    created_at: z.string(),
    created_by: z.string(),
  }),
  patients: z.array(
    z.object({
      vaccination: z.object({
        type: z.string(),
        method: z.string(),
        sequence: z.string(),
        age_at_vaccination: z.number(),
        material_status: z.string(),
        disease_history: z.boolean(),
      }),
      identity: z.object({
        patient_id: z.number(),
        identity_type: z.number(),
        identity_number: z.string(),
        name: z.string(),
        gender: z.string(),
        date_of_birth: z.string(),
        age: z.number(),
        education: z.string(),
        occupation: z.string(),
        religion: z.string(),
        ethnicity: z.string(),
        phone_number: z.string(),
        registered_address: z.string(),
        residential_address: z.string(),
      }),
    })
  ),
  consumption: z.object({
    kipi_history: z.array(
      z.object({
        reaction: z.string(),
        other_reaction: z.string(),
        reaction_date: z.string(),
        sequence_name: z.string(),
      })
    ),
    disease_history_prevention: z.object({
      has_dengue_before: z.boolean(),
      last_dengue_month: z.string(),
      last_dengue_year: z.number(),
      has_voluntary_vaccination: z.boolean(),
    }),
  }),
})

export type TransactionDetailResponseDTO = z.infer<
  typeof TransactionDetailResponseSchema
>
