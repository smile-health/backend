import { Context } from "hono"
import { Publisher } from "@smile-health/lib/rabbitmq/publisher.js"
import { TOPIC } from "@smile-health/lib/rabbitmq/topic.js"

export class SyncExampleModule {
  constructor(private readonly publisher: Publisher) {}

  async create(c: Context, body) {
    console.log("CREATED SYNC EXAMPLE", body)
    this.publisher.publish(TOPIC.MATERIAL_CREATED, body)
    return "success craete sync example"
  }
}
