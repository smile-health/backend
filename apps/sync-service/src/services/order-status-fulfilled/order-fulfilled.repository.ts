import { DB } from "@/common/infrastructure/database/types/db.js"
import { CustomContext } from "@smile-health/lib/types/context.js"
import { collect } from "@smile-health/lib/utils.js"

export class OrderStatusFulfilledRepository {
  async findOrderStockByOrderItemAndStockIdPlatform(
    c: CustomContext<DB>,
    orderItemPlatformId: number,
    stockPlatformId: number,
    programId: number
  ) {
    const result = await c.var.trx
      .selectFrom("mapping_order_stocks")
      .where("platform_order_item_stock_id", "=", orderItemPlatformId)
      .where("platform_stock_id", "=", stockPlatformId)
      .where("program_id", "=", programId)
      .select([
        "id",
        "existing_order_stock_id",
        "platform_order_item_stock_id",
        "platform_stock_id",
      ])
      .execute()
    return collect(result, "existing_order_stock_id")
  }
}
