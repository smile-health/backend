import { z } from "zod"

/*
 * Request
 */
export const PatientDetailRequestSchema = z.object({
  nik: z.string(),
})
export type PatientDetailRequestDTO = z.infer<typeof PatientDetailRequestSchema>

export const PatientVaccineSequenceRequestSchema = z.object({
  nik: z.string(),
  protocol_id: z.string(),
})
export type PatientVaccineSequenceRequestDTO = z.infer<
  typeof PatientVaccineSequenceRequestSchema
>

/*
 * Response
 */
export const PatientResponseSchema = z.object({
  id: z.number(),
  nik: z.string(),
  name: z.string().nullable(),
  gender: z.number(),
  birth_date: z.string().nullable(),
  identity_type: z.number().nullable(),
  phone_number: z.string().nullable(),
  address: z.string().nullable(),
  residential_address: z.string().nullable(),
  pos_code: z.string().nullable(),
  rt: z.string().nullable(),
  rw: z.string().nullable(),
  marital_status: z.object({
    id: z.number().nullable(),
    title: z.string().nullable(),
  }),
  education: z.object({
    id: z.number().nullable(),
    title: z.string().nullable(),
  }),
  occupation: z.object({
    id: z.number().nullable(),
    title: z.string().nullable(),
  }),
  religion: z.object({
    id: z.number().nullable(),
    title: z.string().nullable(),
  }),
  ethnic: z.object({
    id: z.number().nullable(),
    title: z.string().nullable(),
  }),
  location: z.object({
    province: z.object({
      id: z.number().nullable(),
      name: z.string().nullable(),
    }),
    regency: z.object({
      id: z.number().nullable(),
      name: z.string().nullable(),
    }),
    subdistrict: z.object({
      id: z.number().nullable(),
      name: z.string().nullable(),
    }),
    village: z.object({
      id: z.number().nullable(),
      name: z.string().nullable(),
    }),
    residential_province: z.object({
      id: z.number().nullable(),
      name: z.string().nullable(),
    }),
    residential_regency: z.object({
      id: z.number().nullable(),
      name: z.string().nullable(),
    }),
    residential_subdistrict: z.object({
      id: z.number().nullable(),
      name: z.string().nullable(),
    }),
    residential_village: z.object({
      id: z.number().nullable(),
      name: z.string().nullable(),
    }),
  }),
  entity_id: z.number().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
})
export type PatientResponseDTO = z.infer<typeof PatientResponseSchema>

export const PatientVaccineSequenceResponseSchema = z.object({
  nik: z.string(),
  name: z.string().nullable(),
  vaccine_type: z
    .object({
      id: z.number().nullable(),
      name: z.string().nullable(),
    })
    .nullable(),
  vaccine_method: z
    .object({
      id: z.number().nullable(),
      name: z.string().nullable(),
    })
    .nullable(),
  previous_sequence: z
    .object({
      id: z.number().nullable(),
      name: z.string().nullable(),
      qty: z.number().nullable(),
      min: z.number().nullable(),
      max: z.number().nullable(),
    })
    .nullable(),
  next_sequence: z
    .object({
      id: z.number().nullable(),
      name: z.string().nullable(),
      min: z.number().nullable(),
      max: z.number().nullable(),
    })
    .nullable(),
  next_vaccine_method: z
    .object({
      id: z.number().nullable(),
      name: z.string().nullable(),
    })
    .nullable(),
  next_vaccine_type: z
    .object({
      id: z.number().nullable(),
      name: z.string().nullable(),
    })
    .nullable(),
  entity: z
    .object({
      id: z.number().nullable(),
      name: z.string().nullable(),
    })
    .nullable(),
  last_vaccine_date: z.string().nullable(),
})
export type PatientVaccineSequenceResponseDTO = z.infer<
  typeof PatientVaccineSequenceResponseSchema
>

export type ReminderRow = {
  entity_id: number | null
  entity_name: string | null
  consumption_id: number
  protocol_id: number
  identity_number: string | null
  phone_number: string | null
  vaccine_method: string | null
  current_sequence: string | null
  previous_sequence: string | null
  previous_vaccine_date: Date | null
  next_vaccine_date: Date
  stop_notification: number | null
}
