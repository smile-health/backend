import { z } from "zod"

export const AsikAggregateSyncRequestSchema = z.object({
  input_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  page: z.int().positive().optional(),
  iterate: z.boolean().default(true),
  max_pages: z.int().positive().max(5000).default(5000),
})

export type AsikAggregateSyncRequestDTO = z.infer<
  typeof AsikAggregateSyncRequestSchema
>
