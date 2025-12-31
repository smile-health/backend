import { BaseRepository } from "../base.repository.js"

export class OrderStockStatusRepository extends BaseRepository<"ws_order_stock_statuses"> {
  constructor(filterProgram = false, filterActivity = false) {
    super("ws_order_stock_statuses", filterProgram, filterActivity)
  }
}
