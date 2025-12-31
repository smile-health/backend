import { SyncPublisher } from "@smile/lib/base/sync-publisher.js"
import { Publisher } from "@smile/lib/rabbitmq/publisher.js"
import { TOPIC } from "@smile/lib/rabbitmq/topic.js"
import { Context } from "hono"

export class OrderCommentPublisher extends SyncPublisher {
  constructor(publisher: Publisher) {
    super(publisher)
  }

  async processCreate<T>(c: Context, data: T) {
    const message = {
      headers: c.req.header(),
      payload: data,
    }

    c.addEvent(TOPIC.ORDER_COMMENT_CREATED, message)
  }
}
