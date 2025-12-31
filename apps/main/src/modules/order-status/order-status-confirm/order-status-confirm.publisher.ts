import { SyncPublisher } from "@smile/lib/base/sync-publisher.js"
import { Publisher } from "@smile/lib/rabbitmq/publisher.js"
import { TOPIC } from "@smile/lib/rabbitmq/topic.js"
import { Context } from "hono"
import { OrderStatusConfirmRepository } from "./order-status-confirm.repository.js"

interface OrderConfirm {
  order_id: number
  program_id: number
}
export class OrderStatusConfirmPublisher extends SyncPublisher {
  constructor(
    publisher: Publisher,
    private readonly repository: OrderStatusConfirmRepository
  ) {
    super(publisher)
  }

  async processUpdate<T extends OrderConfirm>(c: Context, data: T) {
    const items = await this.repository.getDetailOrderItemByOrderId(
      c,
      data.order_id
    )

    const latestItems = Object.values(
      items.reduce(
        (acc, item) => {
          const existingItem = acc[item.order_id];
          if (
            !existingItem ||
            new Date(item.created_at) > new Date(existingItem.created_at)
          ) {
            acc[item.order_id] = item;
          }
          return acc
        },
        {} as Record<number, (typeof items)[number]>
      )
    )

    const message = {
      headers: c.req.header(),
      payload: {
        data: latestItems,
        order_id: data.order_id,
        program_id: data.program_id,
      },
    }

    c.addEvent(TOPIC.ORDER_STATUS_ORDER_CONFIRM, message)
  }
}
