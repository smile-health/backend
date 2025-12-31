import { Context } from "hono"
import moment from "moment"
import { z } from "zod"

export class QueryParamDateRangeValidator {
  checkToGreaterThanFrom<T extends { from: string; to: string }>(
    c: Context,
    ctx: z.RefinementCtx,
    queryParams: T
  ) {
    if (
      queryParams.from &&
      queryParams.to &&
      queryParams.to < queryParams.from
    ) {
      ctx.addIssue({
        path: ["to"],
        code: z.ZodIssueCode.custom,
        message: c.var.t("validator.greater_than", {
          field1: "to",
          field2: "from",
        }),
      })
    }
  }

  checkExpiredDateDependencies<
    T extends { start_expired_date?: string; end_expired_date?: string },
  >(c: Context, ctx: z.RefinementCtx, queryParams: T) {
    const hasStart = !!queryParams.start_expired_date
    const hasEnd = !!queryParams.end_expired_date

    if (hasStart && !hasEnd) {
      ctx.addIssue({
        path: ["endExpiredDate"],
        code: z.ZodIssueCode.custom,
        message: c.var.t("validator.is_empty"),
      })
    }

    if (hasEnd && !hasStart) {
      ctx.addIssue({
        path: ["startExpiredDate"],
        code: z.ZodIssueCode.custom,
        message: c.var.t("validator.is_empty"),
      })
    }

    if (
      hasStart &&
      hasEnd &&
      moment(queryParams.end_expired_date).isBefore(
        moment(queryParams.start_expired_date)
      )
    ) {
      ctx.addIssue({
        path: ["endExpiredDate"],
        code: z.ZodIssueCode.custom,
        message: c.var.t("validator.greater_than", {
          field1: "endExpiredDate",
          field2: "startExpiredDate",
        }),
      })
    }
  }
}
