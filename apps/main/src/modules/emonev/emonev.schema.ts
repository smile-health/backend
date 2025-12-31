import { z } from "zod"

const dateSchema = z.string().date().optional()

export const GetEmonevProvinceSchema = z.object({
  year: z.coerce.number().int(),
  code: z.string().min(1),
  date_cutoff: dateSchema,
})

export type GetEmonevProvinceQueries = z.infer<typeof GetEmonevProvinceSchema>

export const GetEmonevRegencySchema = GetEmonevProvinceSchema

export type GetEmonevRegencyQueries = z.infer<typeof GetEmonevRegencySchema>
