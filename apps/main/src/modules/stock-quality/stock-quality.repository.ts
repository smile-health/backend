import { DB } from "@/common/infrastructure/database/types/db.js"
import { Context } from "@smile-health/lib/types/context.js"
import { GetListStockQualityQueries } from "./stock-quality.schema.js"

export class StockQualityRepository {
  async findListStockQuality(
    c: Context<DB>,
    params: GetListStockQualityQueries
  ) {
    const { page, paginate, keyword } = params
    const offset = (page - 1) * paginate
    let query = c.var.trx
      .selectFrom("ws_stock_qualities")
      .where("deleted_at", "is", null)

    if (keyword) {
      query = query.where("label", "like", `%${keyword}%`)
    }

    const [list, count] = await Promise.all([
      query
        .limit(paginate)
        .offset(offset)
        .select(["id", "label"])
        .where("deleted_at", "is", null)
        .orderBy("id")
        .execute(),
      query
        .select((fn) => fn.fn.countAll().as("total"))
        .where("deleted_at", "is", null)
        .executeTakeFirstOrThrow(),
    ])

    return {
      list,
      total: Number(count.total),
    }
  }

  async findWsStockQualityIds(c: Context<DB>, ids: number[]) {
    return c.var.trx
      .selectFrom("ws_stock_qualities")
      .select(["id", "label"])
      .where("id", "in", ids)
      .execute()
  }
}
