import { DB } from "@/common/infrastructure/database/types/db.js"
import { Consumer } from "@smile-health/lib/rabbitmq/consumer.js"
import { TOPIC } from "@smile-health/lib/rabbitmq/topic.js"
import { OrderClickhouse } from "../order/order.clickhouse.js"
import { OrderStatusShippedGateway } from "./order-status-shipped.gateway.js"

export class OrderStatusShippedWorker {
  constructor(
    private readonly gateway: OrderStatusShippedGateway,
    private readonly clickhouse: OrderClickhouse
  ) {}

  public registerWorkers(consumer: Consumer<DB>): void {
    consumer.route(TOPIC.ORDER_STATUS_ORDER_SHIPPED, async (c, msg) => {
      const parseMsg = JSON.parse(msg ?? "{}")

      await Promise.all([
        this.gateway.update(c, parseMsg),
        this.clickhouse.updateStatus(parseMsg.payload),
      ])
    })
  }
}
