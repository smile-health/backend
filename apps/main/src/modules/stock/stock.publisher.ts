import { SyncPublisher } from "@smile/lib/base/sync-publisher.js"
import { Publisher } from "@smile/lib/rabbitmq/publisher.js"
import { TOPIC } from "@smile/lib/rabbitmq/topic.js"
import { Context } from "hono"
import { GetStocksQueries } from "./stock.schema.js"

export class StockPublisher extends SyncPublisher {
  constructor(protected readonly publisher: Publisher) {
    super(publisher)
  }

  async processExport(c: Context, params: GetStocksQueries, options: object) {
    const message = {
      headers: c.req.header(),
      payload: {
        params,
        options,
        language: c.var.language,
        // Additional Payload
        config: c.var.config,
      },
    }
    await this.publish(TOPIC.VIEW_STOCK_EXPORTED, message)
  }
}
