import { DB } from "@/common/infrastructure/database/types/db.js"
import { Consumer } from "@smile/lib/rabbitmq/consumer.js"
import { TOPIC } from "@smile/lib/rabbitmq/topic.js"
import { EntityClickhouse } from "./entity.clickhouse.js"
import { EntityGateway } from "./entity.gateway.js"

export class EntityWorker {
  constructor(
    private readonly gateway: EntityGateway,
    private readonly clickhouse: EntityClickhouse
  ) {}

  public registerWorkers(consumer: Consumer<DB>): void {
    consumer.route(TOPIC.ENTITY_CREATED, async (c, msg) => {
      const parseMsg = JSON.parse(msg ?? "{}")
      await Promise.all([
        this.gateway.upsert(c, parseMsg),
        this.clickhouse.create(parseMsg),
      ])
    })

    consumer.route(TOPIC.ENTITY_UPDATED, async (c, msg) => {
      const parseMsg = JSON.parse(msg ?? "{}")
      await Promise.all([
        this.gateway.upsert(c, parseMsg),
        this.clickhouse.update(parseMsg),
      ])
    })
  }
}
