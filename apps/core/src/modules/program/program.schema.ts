import { PaginationQueriesSchema } from "@smile-health/lib/types/paginate.js"
import { z } from "zod"

const configMaterial = z.object({
  is_hierarchy_enabled: z.boolean().default(false),
  is_batch_enabled: z.boolean().default(false),
})

const configOrder = z.object({
  is_create_restricted: z.boolean().default(false),
  is_confirm_restricted: z.boolean().default(false),
})

const config = z.object({
  material: configMaterial.optional(),
  order: configOrder.optional(),
  color: z
    .string()
    .refine((value) => /^#?([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(value), {
      message: "validator.invalid_color",
    })
    .optional(),
  icon_url: z.string().url().optional(),
})

export const ProgramSchema = z.object({
  key: z.string(),
  name: z.string(),
  description: z.string().nullish().optional(),
  config: config,
  protocol_ids: z.array(z.number().int()).optional(),
})

export const ProgramParamsSchema = PaginationQueriesSchema.extend({
  is_hierarchy_enabled: z.string().nullish().optional(),
  is_batch_enabled: z.string().nullish().optional(),
  is_beneficiaries: z.string().nullish().optional(),
  sort_by: z.string().nullish().optional(),
  sort_type: z.string().nullish().optional(),
})

export const DetailSchema = z.object({
  id: z.preprocess(
    (value) => {
      if (value === null) return undefined
      if (typeof value === "string") return parseInt(value, 10)
      return value
    },
    z
      .number()
      .int()
      .nonnegative()
      .refine((v) => !isNaN(v))
  ),
})

export type ProgramRequest = z.infer<typeof ProgramSchema>
export type ProgramParams = z.infer<typeof ProgramParamsSchema>
export type configProgramType = z.infer<typeof config>
export type auditType = {
  id: number
  firstname: string
  lastname: string
  username: string
}
