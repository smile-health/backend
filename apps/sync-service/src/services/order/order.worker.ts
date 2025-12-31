import { DB } from "@/common/infrastructure/database/types/db.js"
import { Consumer } from "@smile/lib/rabbitmq/consumer.js"
import { TOPIC } from "@smile/lib/rabbitmq/topic.js"
import { OrderClickhouse } from "./order.clickhouse.js"
import { OrderGateway } from "./order.gateway.js"

export class OrderWorker {
  constructor(
    private readonly gateway: OrderGateway,
    private readonly clickhouse: OrderClickhouse
  ) {}

  public registerWorkers(consumer: Consumer<DB>): void {
    consumer.route(TOPIC.ORDER_CREATED, async (c, msg) => {
      const parseMsg = JSON.parse(msg ?? "{}")

      await Promise.all([
        this.gateway.create(c, parseMsg),
        this.clickhouse.create(parseMsg.payload),
      ])
    })
  }
}
