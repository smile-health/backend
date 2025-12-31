import { z } from "zod"
import { PaginationQueriesSchema } from "@smile/lib/types/paginate.js"

export const CreateImmunizationSchema = z.object({
  nik: z.string().optional(),
  name: z.string().optional(),
  date_of_birth: z.string().optional().nullable(),
  gender: z.number().optional(),
  parent_name: z.string().optional(),
  phone_number: z.string().optional(),
  marital_status: z.number().optional().nullable(),
  education_id: z.number().optional().nullable(),
  occupation_id: z.number().optional().nullable(),
  religion_id: z.number().optional().nullable(),
  ethnic_id: z.number().optional().nullable(),
  province_id: z.number().optional().nullable(),
  regency_id: z.number().optional().nullable(),
  subdistrict_id: z.number().optional().nullable(),
  village_id: z.number().optional().nullable(),
  address: z.string().optional().nullable(),
  residential_province_id: z.number().optional().nullable(),
  residential_regency_id: z.number().optional().nullable(),
  residential_subdistrict_id: z.number().optional().nullable(),
  residential_village_id: z.number().optional().nullable(),
  residential_address: z.string().optional().nullable(),
})

export const CreateChildRegistrationSchema = CreateImmunizationSchema

export const CreateImmunizationDataSchema = z.object({
  patient_id: z.number(),
  parent_name: z.string().optional(),
  identity_type: z.number().optional(),
  parent_patient_id: z.number().optional(),
})

export const CreateWeighingHistorySchema = z.object({
  patient_immunization_id: z.number().int().positive(),
  input_date: z.string(),
  gender: z.number().int().min(1).max(2),
  weight: z.number().positive(),
  height: z.number().positive(),
  z_score_weight: z.number(),
  z_score_height: z.number(),
  z_score_bmi: z.number(),
})

export const UpdateWeighingHistorySchema = z.object({
  patient_immunization_id: z.number().int().positive(),
  input_date: z.string().optional(),
  gender: z.number().int().min(1).max(2).optional(),
  weight: z.number().positive().optional(),
  height: z.number().positive().optional(),
  z_score_weight: z.number().optional(),
  z_score_height: z.number().optional(),
  z_score_bmi: z.number().optional(),
})

export const WeighingHistoryIdSchema = z.object({
  id: z.string(),
})

export const GetWeighingHistoryListSchema = z.object({
  patient_immunization_id: z.string(),
})

export const ValidateNikSchema = z.object({
  nik: z.string(),
})

export const GetImmunizationSchema = PaginationQueriesSchema.extend({
  keyword: z.string().optional(),
})

export const ImmunizationDetailSchema = z.object({
  id: z.coerce.number().int().positive(),
})

export const immunizationId = z.object({ id: z.string() })

export const PatientIdSchema = z.object({
  id: z.string(),
})

export const UpdateImmunizationSchema = CreateImmunizationSchema

export const UpdateImmunizationStatusSchema = z.object({
  vaccine_status: z
    .enum(["note_only_date", "note_with_batch", "not_given"])
    .optional(),
  injection_date: z.string().optional(),
  batch_id: z.number().int().positive().optional(),
})

export type GetImmunizationQuery = z.TypeOf<typeof GetImmunizationSchema>
export type ImmunizationDetailDTO = z.TypeOf<typeof ImmunizationDetailSchema>

export type CreateChildRegistrationDTO = z.TypeOf<
  typeof CreateChildRegistrationSchema
>
export type CreateImmunizationDTO = z.TypeOf<typeof CreateImmunizationSchema>
export type CreateImmunizationDataDTO = z.TypeOf<
  typeof CreateImmunizationDataSchema
>
export type CreateWeighingHistoryDTO = z.TypeOf<
  typeof CreateWeighingHistorySchema
>
export type UpdateWeighingHistoryDTO = z.TypeOf<
  typeof UpdateWeighingHistorySchema
>
export type UpdateImmunizationStatusDTO = z.TypeOf<
  typeof UpdateImmunizationStatusSchema
>
export type UpdateChildRegistrationDTO = z.TypeOf<
  typeof CreateChildRegistrationSchema
>
