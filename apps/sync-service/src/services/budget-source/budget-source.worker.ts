import { DB } from "@/common/infrastructure/database/types/db.js"
import { Consumer } from "@smile/lib/rabbitmq/consumer.js"
import { TOPIC } from "@smile/lib/rabbitmq/topic.js"
import { BudgetSourceGateway } from "./budget-source.gateway.js"

export class BudgetSourceWorker {
  constructor(private readonly gateway: BudgetSourceGateway) {}

  public registerWorkers(consumer: Consumer<DB>): void {
    consumer.route(TOPIC.BUDGET_SOURCE_CREATED, async (c, msg) => {
      const parseMsg = JSON.parse(msg ?? "{}")
      await this.gateway.upsert(c, parseMsg)
    })

    consumer.route(TOPIC.BUDGET_SOURCE_UPDATED, async (c, msg) => {
      const parseMsg = JSON.parse(msg ?? "{}")
      await this.gateway.upsert(c, parseMsg)
    })
  }
}
