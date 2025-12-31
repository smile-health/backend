import { Context } from "hono"
import { ZodIssueCode } from "zod"
import { GetBudgetSourceQueriesSchema } from "./budget-source.schema.js"

export class BudgetSourceMiddleware {
  constructor() {}

  list = (c: Context) => {
    return GetBudgetSourceQueriesSchema.superRefine(async (val, cfx) => {
      const { sort_by, sort_type } = val
      const sortBys = ["name", "status", "updated_at", "user_updated_by"]
      const sortTypes = ["asc", "desc"]

      if (sort_by && !sortBys.includes(sort_by)) {
        cfx.addIssue({
          code: ZodIssueCode.custom,
          path: ["sort_by"],
          message: c.var.t("validator.one_of", {
            field: "sort_by",
            condition: sortBys,
          }),
        })
      }

      if (sort_type && !sortTypes.includes(sort_type)) {
        cfx.addIssue({
          code: ZodIssueCode.custom,
          path: ["sort_type"],
          message: c.var.t("validator.one_of", {
            field: "sort_type",
            condition: sortTypes,
          }),
        })
      }
    })
  }
}
