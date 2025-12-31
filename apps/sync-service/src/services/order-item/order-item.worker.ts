import { DB } from "@/common/infrastructure/database/types/db.js"
import { Consumer } from "@smile/lib/rabbitmq/consumer.js"
import { TOPIC } from "@smile/lib/rabbitmq/topic.js"
import { OrderItemGateway } from "./order-item.gateway.js"
import { OrderClickhouse } from "../order/order.clickhouse.js"

export class OrderItemWorker {
  constructor(
    private readonly gateway: OrderItemGateway,
    private readonly clickhouse: OrderClickhouse
  ) {}

  public registerWorkers(consumer: Consumer<DB>): void {
    consumer.route(TOPIC.ORDER_ITEM_EDIT_UPDATED, async (c, msg) => {
      const parseMsg = JSON.parse(msg ?? "{}")

      await Promise.all([
        this.gateway.update(c, parseMsg),
        this.clickhouse.updateTotalOrderItems(parseMsg.payload),
      ])
    })
  }
}
