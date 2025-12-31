import { PaginationQueriesSchema } from "@smile/lib/types/paginate.js"
import z from "zod"

export type ProgramDetailDTO = {
  id: number
  key: string
  name: string
  color: string | null
}

export const ListProgramSchema = z.object({
  entity_id: z
    .string()
    .transform((val) => Number(val))
    .refine((v) => !isNaN(v!), { message: "invalid entity_id" }),
  keyword: z.string().optional(),
})

export const ListActivitySchema = z.object({
  destination_program_id: z
    .string()
    .transform((val) => Number(val))
    .refine((v) => !isNaN(v!), { message: "invalid destination_program_id" }),
  material_id: z
    .string()
    .transform((val) => Number(val))
    .refine((v) => !isNaN(v!), { message: "invalid material_id" }),
})

export const ListStockSchema = PaginationQueriesSchema.extend({
  destination_program_id: z
    .string()
    .transform((val) => Number(val))
    .refine((v) => !isNaN(v!), { message: "invalid destination_program_id" }),
  entity_id: z
    .string()
    .transform((val) => Number(val))
    .refine((v) => !isNaN(v!), { message: "invalid entity_id" }),
  with_details: z.enum(["0", "1"]).default("0").transform(Number).optional(),
})

export type GetListProgramQueries = z.infer<typeof ListProgramSchema>
export type GetListActivityQueries = z.infer<typeof ListActivitySchema>
export type GetListStockQueries = z.infer<typeof ListStockSchema>
