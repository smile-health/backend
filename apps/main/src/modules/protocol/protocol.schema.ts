import { PaginationQueriesSchema } from "@smile-health/lib/types/paginate.js"
import z from "zod"

export const GetListProtocolSchema = PaginationQueriesSchema
export const GetListVaccineSequenceSchema = PaginationQueriesSchema.extend({
  nik: z.string().optional(),
})

export const SequenceSchema = z.object({
  protocolId: z
    .string({ required_error: "Protocol Id is required" })
    .transform((v) => parseInt(v))
    .refine((v) => !isNaN(v), { message: "Invalid type" }),
})

export const DeleteProtocolMaterialActivitySchema = SequenceSchema.extend({
  id: z
    .string({ required_error: "ID is required" })
    .transform((v) => parseInt(v))
    .refine((v) => !isNaN(v), { message: "Invalid type" }),
})

export const ProtocolMateralActivitySchema = z.object({
  protocol_id: z.number({ required_error: "Protocol ID is required" }).int(),
  material_activities: z.array(
    z.object({
      material_id: z
        .number({ required_error: "Material ID is required" })
        .int(),
      activity_id: z
        .number({ required_error: "Activity ID is required" })
        .int(),
    })
  ),
})

export const StatusProtocolSchema =  z.object({
  status: z.number({ required_error: "Status is required" }).int().min(0).max(1),
})

export type GetProtocolQueries = z.infer<typeof GetListProtocolSchema>
export type GetVaccineSequenceQueries = z.infer<
  typeof GetListVaccineSequenceSchema
>
export type ProtocolMaterialActivityBody = z.infer<
  typeof ProtocolMateralActivitySchema
>

export type StatusProtocolBody = z.infer<typeof StatusProtocolSchema>

export type SequenceItem = {
  id: number
  title: string
  min: number
  max: number
  ideal_age: number
  max_age: number
  active_duration: number
}

export type MethodItem = {
  id: number
  title: string
  is_multi_patient: number
  sequences: SequenceItem[]
}

export type TypeItem = {
  id: number
  title: string
  methods: MethodItem[]
  _methodMap?: Map<number, MethodItem> // hanya sementara
}

export type VaccineResult = {
  protocol: string
  is_kipi: number
  is_medical_history: number
  is_identity_type: number
  is_vaccine_type: boolean
  is_vaccine_method: boolean
  data: any[]
}
