import { DB } from "@/common/infrastructure/database/types/db.js"
import { Consumer } from "@smile/lib/rabbitmq/consumer.js"
import { TOPIC } from "@smile/lib/rabbitmq/topic.js"
import { EntityCustomerGateway } from "./entity-customer.gateway.js"

export class EntityCustomerWorker {
  constructor(private readonly gateway: EntityCustomerGateway) {}

  public registerWorkers(consumer: Consumer<DB>): void {
    consumer.route(TOPIC.ENTITY_CUSTOMER_UPDATED, async (c, msg) => {
      const parseMsg = JSON.parse(msg ?? "{}")
      await this.gateway.update(c, parseMsg)
    })
  }
}
