import z from "zod"

// Series configuration schema
export const SeriesConfigSchema = z.object({
  id: z.number(),
  label: z.string(),
  key: z.string(),
  color: z.string(),
})

export type SeriesConfig = z.infer<typeof SeriesConfigSchema>
