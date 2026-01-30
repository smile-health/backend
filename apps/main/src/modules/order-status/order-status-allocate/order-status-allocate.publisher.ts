import { SyncPublisher } from "@smile-health/lib/base/sync-publisher.js"
import { Publisher } from "@smile-health/lib/rabbitmq/publisher.js"
import { TOPIC } from "@smile-health/lib/rabbitmq/topic.js"
import { Context } from "hono"
import { OrderStatusAllocateRepository } from "./order-status-allocate.repository.js"

interface OrderAllocate {
  order_id: number
  program_id: number
}
export class OrderStatusAllocatePublisher extends SyncPublisher {
  constructor(
    publisher: Publisher,
    private readonly repository: OrderStatusAllocateRepository
  ) {
    super(publisher)
  }

  async processUpdate<T extends OrderAllocate>(c: Context, data: T) {
    const items = await this.repository.getDetailOrderItemByOrderId(
      c,
      data.order_id
    )

    const message = {
      headers: c.req.header(),
      payload: {
        data: items,
        order_id: data.order_id,
        program_id: data.program_id,
      },
    }

    c.addEvent(TOPIC.ORDER_STATUS_ORDER_ALLOCATE, message)
  }
}
