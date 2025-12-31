import { QueryParamDateRangeValidator } from "@/common/validators/query-param-date-range.validator.js"
import { Context } from "hono"
import moment from "moment"
import { z } from "zod"
import {
  UserActivityQueryParams,
  UserActivitySchema,
} from "./user-activity.schema.js"

export class UserActivityMiddleware {
  constructor(
    private readonly queryParamDateRangeValidator: QueryParamDateRangeValidator
  ) {}

  common = (c: Context) => {
    return UserActivitySchema.superRefine(
      async (queryParams: UserActivityQueryParams, ctx: z.RefinementCtx) => {
        this.queryParamDateRangeValidator.checkToGreaterThanFrom(
          c,
          ctx,
          queryParams
        )
        queryParams.program_id = c.var.programId
        queryParams.from = moment(queryParams.from, "YYYY-MM-DD").format(
          "YYYY-MM-01"
        )
        queryParams.to = moment(queryParams.from, "YYYY-MM-DD")
          .endOf("month")
          .format("YYYY-MM-DD")
        queryParams.current_date = moment(queryParams.to).format("YYYY-MM-DD")
      }
    )
  }
}
