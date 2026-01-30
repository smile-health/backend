import { DB } from "@/common/infrastructure/database/types/db.js"
import { Consumer } from "@smile-health/lib/rabbitmq/consumer.js"
import { TOPIC } from "@smile-health/lib/rabbitmq/topic.js"
import { ManufactureGateway } from "./manufacture.gateway.js"

export class ManufactureWorker {
  constructor(private readonly gateway: ManufactureGateway) {}

  public registerWorkers(consumer: Consumer<DB>): void {
    consumer.route(TOPIC.MANUFACTURE_CREATED, async (c, msg) => {
      const parseMsg = JSON.parse(msg ?? "{}")
      await this.gateway.upsert(c, parseMsg)
    })

    consumer.route(TOPIC.MANUFACTURE_UPDATED, async (c, msg) => {
      const parseMsg = JSON.parse(msg ?? "{}")
      await this.gateway.upsert(c, parseMsg)
    })

    consumer.route(TOPIC.MANUFACTURE_STATUS_UPDATED, async (c, msg) => {
      const parseMsg = JSON.parse(msg ?? "{}")
      await this.gateway.updateStatus(c, parseMsg)
    })
  }
}
