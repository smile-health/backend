import { IdParamsSchema } from "@smile-health/lib/types/param.js"
import z from "zod"

export const GetPopulationByProgramPlanParamsSchema = IdParamsSchema
export type GetPopulationByProgramPlanParams = z.infer<
  typeof GetPopulationByProgramPlanParamsSchema
>

export const GetPopulationByProgramPlanQueriesSchema = z.object({
  province_id: z.coerce.number(),
})

export type GetPopulationByProgramPlanQueries = z.infer<
  typeof GetPopulationByProgramPlanQueriesSchema
>
