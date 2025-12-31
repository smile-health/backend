import { SyncPublisher } from "@smile/lib/base/sync-publisher.js"
import { Publisher } from "@smile/lib/rabbitmq/publisher.js"
import { TOPIC } from "@smile/lib/rabbitmq/topic.js"
import { Context } from "hono"

export class UserPublisher extends SyncPublisher {
  constructor(publisher: Publisher) {
    super(publisher)
  }

  async processUpdateStatus<T>(c: Context, data: T) {
    const message = {
      headers: c.req.header(),
      payload: data,
    }

    c.addEvent(TOPIC.USER_STATUS_UPDATED, message)
  }
}
