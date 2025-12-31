import { SyncPublisher } from "@smile/lib/base/sync-publisher.js"
import { Publisher } from "@smile/lib/rabbitmq/publisher.js"
import { TOPIC } from "@smile/lib/rabbitmq/topic.js"
import { collect } from "@smile/lib/utils.js"
import { Context } from "hono"
import { EntityCustomerRepository } from "./entity-customer.repository.js"

export class EntityCustomerPublisher extends SyncPublisher {
  constructor(
    publisher: Publisher,
    private readonly repo: EntityCustomerRepository
  ) {
    super(publisher)
  }

  async processUpdate(c: Context, entityId: number, isConsumption?: number) {
    const customers = await this.repo.find(c, {
      vendor_id: entityId,
      program_id: c.var.programId,
    })

    const message = {
      headers: c.req.header(),
      payload: {
        program_id: c.var.programId,
        entity_id: entityId,
        customer_ids: collect(customers, "customer_id"),
        is_consumption: isConsumption ?? customers[0]?.is_consumption ?? 0,
      },
    }

    c.addEvent(TOPIC.ENTITY_CUSTOMER_UPDATED, message)
  }
}
