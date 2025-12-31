import { SyncPublisher } from "@smile/lib/base/sync-publisher.js"
import { Publisher } from "@smile/lib/rabbitmq/publisher.js"
import { TOPIC } from "@smile/lib/rabbitmq/topic.js"
import { Context } from "hono"
import { OrderStatusShipRepository } from "./order-status-ship.repository.js"

interface OrderShipped {
  order_id: number
  program_id: number
}
export class OrderStatusShippedPublisher extends SyncPublisher {
  constructor(
    publisher: Publisher,
    private readonly repository: OrderStatusShipRepository
  ) {
    super(publisher)
  }

  async processUpdate<T extends OrderShipped>(c: Context, data: T) {
    const items = await this.repository.getDetailOrderItemByOrderId(
      c,
      data.order_id
    )

    const latestItems = Object.values(
      items.reduce(
        (acc, item) => {
          const existing = acc[item.order_id]
          if (
            !existing ||
            new Date(item.created_at) > new Date(existing.created_at)
          ) {
            acc[item.order_id] = item
          }
          return acc
        },
        {} as Record<number, (typeof items)[number]>
      )
    )

    const message = {
      headers: c.req.header(),
      payload: {
        data: latestItems[0],
        order_id: data.order_id,
        program_id: data.program_id,
      },
    }

    c.addEvent(TOPIC.ORDER_STATUS_ORDER_SHIPPED, message)
  }

  async processNotification(c: Context, payload) {
    payload.messageTranslation = this.publisher.setMessage(c, payload.message)
    payload.titleTranslation = this.publisher.setMessage(c, payload.title)
    await this.publisher.publishNotification(c, payload.worker, payload)
  }
}
