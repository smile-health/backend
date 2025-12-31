import { BaseMiddleware } from "@smile/lib/base/middleware.js"
import { ValidationError } from "@smile/lib/error.js"
import { validator } from "hono/validator"
import { z } from "zod"
import StockOpnamePeriodRepository from "./stock-opname-period.repository.js"
import { CreateStockOpnamePeriodRequest } from "./stock-opname-period.schema.js"

export class StockOpnamePeriodMiddleware extends BaseMiddleware {
  constructor(private readonly repo: StockOpnamePeriodRepository) {
    super()
  }

  public checkPeriodExists() {
    return validator("json", async (value, c) => {
      const { month_period, year_period } = value as z.infer<
        typeof CreateStockOpnamePeriodRequest
      >
      const { id } = c.req.param() as { id: number }

      const existingPeriod = await this.repo.findOne(c, {
        month_period,
        year_period,
      })

      if (existingPeriod && existingPeriod.id !== Number(id)) {
        c.addError("month_period", "validator.exist")
        c.addError("year_period", "validator.exist")
      }

      if (id && existingPeriod?.status !== 1) {
        throw new ValidationError(
          c.var.t("validator.not_active", {
            field: c.var.t("stock_opname.label.period"),
          })
        )
      }

      return value
    })
  }
}
