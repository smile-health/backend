import { PaginationQueriesSchema } from "@smile-health/lib/types/paginate.js"
import { z } from "zod"

export const GetListProtocolSchema = PaginationQueriesSchema.extend({
    program_id: z.string().optional(),
})
export const SequenceSchema = z.object({
  protocolId: z
    .string({
        error: (issue) => issue.input === undefined ? "Protocol Id is required" : undefined
    })
    .transform((v) => parseInt(v))
    .refine((v) => !isNaN(v), {
        error: "Invalid type"
    }),
})

export const PrococolSchema = z.object({
  name: z.string({
      error: (issue) => issue.input === undefined ? "Protocol name is required" : undefined
}),
  is_kipi: z.number().optional(),
  is_medical_history: z.number().optional(),
})

export const ProtocolProgramSchema = z.object({
  program_id: z.int(),
  protocol_ids: z.array(
    z.int()
  ),
})

export type GetProtocolQueries = z.infer<typeof GetListProtocolSchema>
export type ProtocolProgramBody = z.infer<typeof ProtocolProgramSchema>
