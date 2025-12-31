import { Context } from "hono"
import { ZodIssueCode } from "zod"
import { GetDisposalStocksQueriesSchema } from "./disposal-stock.schema.js"

export class DisposalStockMiddleware {
  constructor() {}

  list = (c: Context) => {
    return GetDisposalStocksQueriesSchema.superRefine(async (data, ctx) => {
      const { expired_from, expired_to } = data
      if (expired_from && !expired_to) {
        ctx.addIssue({
          code: ZodIssueCode.custom,
          message: c.var.t("validator.required", {
            field: c.var.t("common.expired_to"),
          }),
          path: ["expired_to"],
        })
      }
      if (!expired_from && expired_to) {
        ctx.addIssue({
          code: ZodIssueCode.custom,
          message: c.var.t("validator.required", {
            field: c.var.t("common.expired_from"),
          }),
          path: ["expired_from"],
        })
      }
      if (expired_from && expired_to) {
        if (expired_from > expired_to) {
          ctx.addIssue({
            code: ZodIssueCode.custom,
            message: c.var.t("validator.end_date_before_start_date"),
            path: ["expired_from"],
          })
        }
      }
    })
  }
}
