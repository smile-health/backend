import { DateSchema } from "@smile/lib/types/param.js"
import z from "zod"

const preprocessNumber = (value: unknown) => {
  if (value === null || value === "") return undefined
  if (typeof value === "string") return parseInt(value, 10)
  if (typeof value === "number") return value
  return undefined
}

const PositiveIntSchema = z.number().int().positive()

export const ConsumptionReactionParamSchema = z.object({
  id: z.preprocess(preprocessNumber, PositiveIntSchema),
})

export const ConsumptionReactionRequestSchema = z.object({
  reaction_id: z.preprocess(preprocessNumber, PositiveIntSchema),
  other_reaction: z.string().optional(),
  actual_date: DateSchema,
})

export type ConsumptionReactionParamDTO = z.infer<
  typeof ConsumptionReactionParamSchema
>
export type ConsumptionReactionRequestDTO = z.infer<
  typeof ConsumptionReactionRequestSchema
>
