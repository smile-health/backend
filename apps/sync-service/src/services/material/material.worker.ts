import { DB } from "@/common/infrastructure/database/types/db.js"
import { Consumer } from "@smile/lib/rabbitmq/consumer.js"
import { TOPIC } from "@smile/lib/rabbitmq/topic.js"
import { MaterialGateway } from "./material.gateway.js"

export class MaterialWorker {
  constructor(private readonly gateway: MaterialGateway) {}

  public registerWorkers(consumer: Consumer<DB>): void {
    consumer.route(TOPIC.MATERIAL_CREATED, async (c, msg) => {
      const parseMsg = JSON.parse(msg ?? "{}")
      await this.gateway.create(c, parseMsg)
    })

    consumer.route(TOPIC.MATERIAL_UPDATED, async (c, msg) => {
      const parseMsg = JSON.parse(msg ?? "{}")
      await this.gateway.update(c, parseMsg)
    })
  }
}
