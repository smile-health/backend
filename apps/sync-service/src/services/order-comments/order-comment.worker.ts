import { DB } from "@/common/infrastructure/database/types/db.js"
import { Consumer } from "@smile-health/lib/rabbitmq/consumer.js"
import { TOPIC } from "@smile-health/lib/rabbitmq/topic.js"
import { OrderCommentGateway } from "./order-comment.gateway.js"

export class OrderCommentsWorker {
  constructor(private readonly gateway: OrderCommentGateway) {}

  public registerWorkers(consumer: Consumer<DB>): void {
    consumer.route(TOPIC.ORDER_COMMENT_CREATED, async (c, msg) => {
      const parseMsg = JSON.parse(msg ?? "{}")
      await this.gateway.create(c, parseMsg)
    })
  }
}
