import { PaginationQueriesSchema } from "@smile/lib/types/paginate"
import { number, z } from "zod"

const preprocessNumber = (value: unknown) => {
  if (value === null || value === "") return undefined
  if (typeof value === "string") return parseInt(value, 10)
  if (typeof value === "number") return value
  return undefined
}

const optionalDateSchema = z
  .string()
  .date()
  .or(z.literal(""))
  .nullish()
  .transform((date) => (date ? new Date(date) : null))

export const GetExportHistoriesQueries = PaginationQueriesSchema.extend({
  start_date: optionalDateSchema,
  end_date: optionalDateSchema,
  program_id: z.preprocess(preprocessNumber, number().optional()),
})

export const DownloadFileParams = z.object({
  file: z.string().min(1),
})
