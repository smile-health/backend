import { SyncPublisher } from "@smile-health/lib/base/sync-publisher.js"
import { Publisher } from "@smile-health/lib/rabbitmq/publisher.js"
import { TOPIC } from "@smile-health/lib/rabbitmq/topic.js"
import { Context } from "hono"

export class ActivityPublisher extends SyncPublisher {
  constructor(publisher: Publisher) {
    super(publisher)
  }

  async processCreate<T>(c: Context, data: T) {
    const message = {
      headers: c.req.header(),
      payload: data,
    }

    c.addEvent(TOPIC.ACTIVITY_CREATED, message)
  }

  async processUpdate<T>(c: Context, data: T) {
    const message = {
      headers: c.req.header(),
      payload: data,
    }

    c.addEvent(TOPIC.ACTIVITY_UPDATED, message)
  }

  // TODO: remove this or not ? FYI delete activity endpoint has been requested to be removed
  async processDelete<T>(c: Context, data: T) {
    const message = {
      headers: c.req.header(),
      payload: data,
    }

    c.addEvent(TOPIC.ACTIVITY_DELETED, message)
  }
}
