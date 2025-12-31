import { SyncPublisher } from "@smile/lib/base/sync-publisher.js"
import { Publisher } from "@smile/lib/rabbitmq/publisher.js"
import { TOPIC } from "@smile/lib/rabbitmq/topic.js"
import { Context } from "hono"

export interface OrderCancel {
  cancel_reason: number | null | undefined
  reason_text: string | null | undefined
  comment: string | null | undefined
  order_id: number
  program_id: number
}
export class OrderStatusCancelPublisher extends SyncPublisher {
  constructor(publisher: Publisher) {
    super(publisher)
  }

  async processUpdate<T extends OrderCancel>(c: Context, data: T) {
    const message = {
      headers: c.req.header(),
      payload: {
        data,
        order_id: data.order_id,
        program_id: data.program_id,
      },
      user: c.var.user,
    }

    c.addEvent(TOPIC.ORDER_STATUS_ORDER_CANCEL, message)
  }
}
