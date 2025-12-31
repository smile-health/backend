import { SyncPublisher } from "@smile/lib/base/sync-publisher.js"
import { Publisher } from "@smile/lib/rabbitmq/publisher.js"
import { TOPIC } from "@smile/lib/rabbitmq/topic.js"
import { Context } from "hono"

export class EntityMaterialPublisher extends SyncPublisher {
  constructor(publisher: Publisher) {
    super(publisher)
  }

  async processCreate<T>(c: Context, data: T) {
    const message = {
      headers: c.req.header(),
      payload: data,
    }

    c.addEvent(TOPIC.ENTITY_MATERIAL_CREATED, message)
  }

  async processUpdate<T>(c: Context, data: T) {
    const message = {
      headers: c.req.header(),
      payload: data,
    }

    c.addEvent(TOPIC.ENTITY_MATERIAL_UPDATED, message)
  }

  async processDelete<T>(c: Context, data: T) {
    const message = {
      headers: c.req.header(),
      payload: data,
    }

    c.addEvent(TOPIC.ENTITY_MATERIAL_DELETED, message)
  }
}
