import { DB } from "@/common/infrastructure/database/types/db.js"
import { Consumer } from "@smile-health/lib/rabbitmq/consumer.js"
import { TOPIC } from "@smile-health/lib/rabbitmq/topic.js"
import { ActivityGateway } from "./activity.gateway.js"

export class ActivityWorker {
  constructor(private readonly gateway: ActivityGateway) {}

  public registerWorkers(consumer: Consumer<DB>): void {
    consumer.route(TOPIC.ACTIVITY_CREATED, async (c, msg) => {
      const parseMsg = JSON.parse(msg ?? "{}")
      await this.gateway.create(c, parseMsg)
    })

    consumer.route(TOPIC.ACTIVITY_UPDATED, async (c, msg) => {
      const parseMsg = JSON.parse(msg ?? "{}")
      await this.gateway.udpate(c, parseMsg)
    })

    consumer.route(TOPIC.ACTIVITY_DELETED, async (c, msg) => {
      const parseMsg = JSON.parse(msg ?? "{}")
      await this.gateway.delete(c, parseMsg)
    })
  }
}
