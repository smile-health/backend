import { DB } from "@/common/infrastructure/database/types/db.js"
import { Consumer } from "@smile/lib/rabbitmq/consumer.js"
import { TOPIC } from "@smile/lib/rabbitmq/topic.js"
import { EntityMaterialGateway } from "./entity-material.gateway.js"

export class EntityMaterialWorker {
  constructor(private readonly gateway: EntityMaterialGateway) {}

  public registerWorkers(consumer: Consumer<DB>): void {
    consumer.route(TOPIC.ENTITY_MATERIAL_CREATED, async (c, msg) => {
      const parseMsg = JSON.parse(msg ?? "{}")
      await this.gateway.create(c, parseMsg)
    })

    consumer.route(TOPIC.ENTITY_MATERIAL_UPDATED, async (c, msg) => {
      const parseMsg = JSON.parse(msg ?? "{}")
      await this.gateway.update(c, parseMsg)
    })

    consumer.route(TOPIC.ENTITY_MATERIAL_DELETED, async (c, msg) => {
      const parseMsg = JSON.parse(msg ?? "{}")
      await this.gateway.delete(c, parseMsg)
    })
  }
}
