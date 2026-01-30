import { SyncPublisher } from "@smile-health/lib/base/sync-publisher.js"
import { Publisher } from "@smile-health/lib/rabbitmq/publisher.js"
import { TOPIC } from "@smile-health/lib/rabbitmq/topic.js"
import { Context } from "hono"
import { OrderStatusFulfilled } from "./order-status-fulfilled.schema.js"

export class OrderStatusFulfilledPublisher extends SyncPublisher {
  constructor(publisher: Publisher) {
    super(publisher)
  }

  async processUpdate<T extends OrderStatusFulfilled>(c: Context, data: T) {
    const message = {
      headers: c.req.header(),
      payload: {
        data,
        order_id: data.order_id,
        program_id: data.program_id,
        fulfilled_at: data.fulfilled_at,
      },
      user: c.var.user,
    }

    c.addEvent(TOPIC.ORDER_STATUS_ORDER_FULFILLED, message)
  }
}
