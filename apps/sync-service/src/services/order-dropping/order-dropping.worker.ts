import { DB } from "@/common/infrastructure/database/types/db.js"
import { Consumer } from "@smile/lib/rabbitmq/consumer.js"
import { TOPIC } from "@smile/lib/rabbitmq/topic.js"
import { OrderDroppingGateway } from "./order-dropping.gateway.js"
import { OrderClickhouse } from "../order/order.clickhouse.js"

export class OrderDroppingWorker {
  constructor(
    private readonly gateway: OrderDroppingGateway,
    private readonly clickhouse: OrderClickhouse
  ) {}

  public registerWorkers(consumer: Consumer<DB>): void {
    consumer.route(TOPIC.ORDER_DROPPING_CREATED, async (c, msg) => {
      const parseMsg = JSON.parse(msg ?? "{}")
      await Promise.all([
        this.gateway.create(c, parseMsg),
        this.clickhouse.create(parseMsg.payload),
      ])
    })
  }
}
