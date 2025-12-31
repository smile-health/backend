import { PaginationQueriesSchema } from "@smile/lib/types/paginate.js"
import z from "zod"

export const GetListProtocolSchema = PaginationQueriesSchema.extend({
    program_id: z.string().optional(),
})
export const SequenceSchema = z.object({
  protocolId: z
    .string({ required_error: "Protocol Id is required" })
    .transform((v) => parseInt(v))
    .refine((v) => !isNaN(v), { message: "Invalid type" }),
})

export const PrococolSchema = z.object({
  name: z.string({ required_error: "Protocol name is required" }),
  is_kipi: z.number().optional(),
  is_medical_history: z.number().optional(),
})

export const ProtocolProgramSchema = z.object({
  program_id: z.number({ required_error: "Program ID is required" }).int(),
  protocol_ids: z.array(
    z.number({ required_error: "Protocol ID is required" }).int()
  ),
})

export type GetProtocolQueries = z.infer<typeof GetListProtocolSchema>
export type ProtocolProgramBody = z.infer<typeof ProtocolProgramSchema>
