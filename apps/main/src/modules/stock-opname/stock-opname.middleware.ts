import { BaseMiddleware } from "@smile-health/lib/base/middleware.js"
import { validator } from "hono/validator"
import { z } from "zod"
import StockOpnamePeriodRepository from "../stock-opname-period/stock-opname-period.repository.js"
import StockOpnameRepository from "./stock-opname.repository.js"
import { CreateStockOpnameRequest } from "./stock-opname.schema.js"
import { ValidationError } from "@smile-health/lib/error.js"

export class StockOpnameMiddleware extends BaseMiddleware {
  constructor(
    private readonly repo: StockOpnameRepository,
    private readonly periodRepo: StockOpnamePeriodRepository
  ) {
    super()
  }

  public validateSchema() {
    return validator("json", async (value, c) => {
      return await this.validateRequest(c, CreateStockOpnameRequest, value)
    })
  }
  // check if the stock opname is submitted within the period
  public checkIsWithinPeriod() {
    return validator("json", async (value, c) => {
      const data = value as z.infer<typeof CreateStockOpnameRequest>
      const period = await this.periodRepo.findOne(c, {
        id: data.period_id,
      })
      const periodLabel = c.var.t("stock_opname.label.period")
      if (!period) {
        c.addError("period_id", "validator.not_exist", periodLabel)
      } else if (period.status !== 1) {
        c.addError("period_id", "validator.not_active", periodLabel)
      }

      const now = new Date()
      data.is_within_period =
        (!period?.start_date || now >= period.start_date) &&
        (!period?.end_date || now <= period.end_date)
          ? 1
          : 0

      return data
    })
  }

  public checkIsUniqueMaterialAndBatch() {
    return validator("json", async (value, c) => {
      const data = value as z.infer<typeof CreateStockOpnameRequest>
      const seen = new Map<
        string,
        { stockIds: Set<number | null>; batchCode: string }
      >()
      const duplicateBatchCode: string[] = []

      const materials = await this.repo.getMaterialByIds(
        c,
        data.items.map((item) => item.material_id)
      )

      for (const item of data.items) {
        // Lewati material yang tidak dikelola per batch
        if (!materials[item.material_id]?.is_managed_in_batch) continue

        for (const stock of item.stocks) {
          const activityId = stock.activity_id ?? ""
          const batchCode = stock.batch_code ?? ""
          const stockId = stock.stock_id ?? null
          const key = `${item.material_id}-${batchCode}-${activityId}`

          const existing = seen.get(key)

          if (existing) {
            const hasSameStockId = stockId && existing.stockIds.has(stockId)
            const hasNullStockId = existing.stockIds.has(null)
            const isNullStockId = !stockId

            // ❌ Kondisi duplikat:
            if (hasSameStockId || hasNullStockId || isNullStockId) {
              c.addError(
                "batch_code",
                c.var.t("validator.duplicated", {
                  field: batchCode,
                }),
                batchCode
              )
              duplicateBatchCode.push(batchCode)
            } else {
              // ✅ Tambahkan stock_id berbeda ke set
              existing.stockIds.add(stockId)
            }
          } else {
            // Simpan pertama kali muncul
            seen.set(key, {
              stockIds: new Set([stockId]),
              batchCode,
            })
          }
        }
      }

      if (duplicateBatchCode.length) {
        throw new ValidationError(
          c.var.t("validator.field_value_duplicated", {
            field: c.var.t("transaction.export.batch_code"),
            values: duplicateBatchCode.join(", "),
          })
        )
      }

      return data
    })
  }
}
