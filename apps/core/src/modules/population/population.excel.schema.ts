import { z } from "zod"

export const ImportPopulationParamsSchema = z.object({
  year: z
    .string({
      error: (issue) =>
        issue.input === undefined ? "validator.required" : "validator.string",
    })
    .regex(/^\d+$/, {
      error: "validator.number",
    })
    .transform((v) => Number(v)),
})
export type ImportPopulationParams = z.infer<
  typeof ImportPopulationParamsSchema
>

export const PopulationImportBaseSchema = z.object({
  entity_id: z.coerce
    .number({
      error: (issue) =>
        issue.input === undefined ? undefined : "validator.number",
    })
    .optional(),
  items: z.array(
    z.object({
      target_group_title: z.string({
        error: (issue) =>
          issue.input === undefined ? "validator.required" : "validator.string",
      }),
      // zod 4: z.any().transform() menjadikan key wajib; .optional() menjaga sel kosong tetap 0.
      population_number: z
        .any()
        .optional()
        .transform((v, ctx) => {
          if (v == null || v === "") return 0

          const n = Number(v)
          if (!Number.isFinite(n) || n < 0) {
            ctx.addIssue({
              code: "custom",
              message: "validator.number",
            })
            return z.NEVER
          }

          return n
        }),
    })
  ),
})

export const PopulationImportSchema = PopulationImportBaseSchema.superRefine(
  (data, ctx) => {
    const hasData =
      Array.isArray(data.items) &&
      data.items.some(
        (it) =>
          Number.isFinite(it.population_number) && it.population_number > 0
      )

    if (!hasData) return

    const v = data.entity_id
    if (!(Number.isFinite(v) && (v as number) > 0)) {
      ctx.addIssue({
        code: "custom",
        message: "validator.number",
        path: ["entity_id"],
      })
    }
  }
)
export type PopulationImportRequestDTO = z.infer<typeof PopulationImportSchema>

export const ExportPopulationParamsSchema = z.object({
  year: z.coerce.number(),
})
export type ExportPopulationParams = z.infer<
  typeof ExportPopulationParamsSchema
>

export const ExportPopulationQueriesSchema = z.object({
  province_id: z.coerce.number(),
})
export type ExportPopulationQueries = z.infer<
  typeof ExportPopulationQueriesSchema
>
