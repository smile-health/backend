import { DB } from "@/common/infrastructure/database/types/db.js"
import { Consumer } from "@smile-health/lib/rabbitmq/consumer.js"
import { TOPIC } from "@smile-health/lib/rabbitmq/topic.js"
import { UserGateway } from "./user.gateway.js"

export class UserWorker {
  constructor(private readonly gateway: UserGateway) {}

  public registerWorkers(consumer: Consumer<DB>): void {
    consumer.route(TOPIC.USER_CREATED, async (c, msg) => {
      const parseMsg = JSON.parse(msg ?? "{}")
      await this.gateway.upsert(c, parseMsg)
    })

    consumer.route(TOPIC.USER_UPDATED, async (c, msg) => {
      const parseMsg = JSON.parse(msg ?? "{}")
      await this.gateway.upsert(c, parseMsg)
    })

    consumer.route(TOPIC.USER_STATUS_UPDATED, async (c, msg) => {
      const parseMsg = JSON.parse(msg ?? "{}")
      await this.gateway.updateStatus(c, parseMsg)
    })

    consumer.route(TOPIC.USER_PASSWORD_UPDATED, async (c, msg) => {
      const parseMsg = JSON.parse(msg ?? "{}")
      await this.gateway.updatePassword(c, parseMsg)
    })
  }
}
