import { SyncPublisher } from "@smile-health/lib/base/sync-publisher.js"
import { Publisher } from "@smile-health/lib/rabbitmq/publisher.js"
import { TOPIC } from "@smile-health/lib/rabbitmq/topic.js"
import { Context } from "hono"
import { OrderItemStockRepository } from "./order-item-stock.repository.js"

interface OrderItemStock {
  order_id: number
  program_id: number
  ids: number[]
}
export class OrderItemStockPublisher extends SyncPublisher {
  constructor(
    publisher: Publisher,
    private readonly repository: OrderItemStockRepository
  ) {
    super(publisher)
  }

  async processUpdate<T extends OrderItemStock>(c: Context, data: T) {
    const items = await this.repository.getOrderItemStockByIds(c, data.ids)

    const message = {
      headers: c.req.header(),
      payload: {
        order_items: items,
        order_id: data.order_id,
        program_id: data.program_id,
      },
    }

    c.addEvent(TOPIC.ORDER_ITEM_EDIT_UPDATED, message)
  }
}
