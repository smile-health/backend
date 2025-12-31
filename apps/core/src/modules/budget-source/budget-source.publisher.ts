import { SyncPublisher } from "@smile/lib/base/sync-publisher.js"
import { Publisher } from "@smile/lib/rabbitmq/publisher.js"
import { TOPIC } from "@smile/lib/rabbitmq/topic.js"
import { Context } from "hono"
import { BudgetSourceRepository } from "./budget-source.repository.js"

export class BudgetSourcePublisher extends SyncPublisher {
  constructor(
    protected readonly publisher: Publisher,
    protected readonly repo: BudgetSourceRepository
  ) {
    super(publisher)
  }

  async processCreate<T>(c: Context, id: number, data: T): Promise<void> {
    const message = await this.buildPayload(c, id, data)
    await this.publish(TOPIC.BUDGET_SOURCE_CREATED, message)
  }

  async processUpdate<T>(c: Context, id: number, data: T): Promise<void> {
    const message = await this.buildPayload(c, id, data)
    await this.publish(TOPIC.BUDGET_SOURCE_UPDATED, message)
  }

  private async buildPayload<T>(c: Context, id: number, data: T) {
    const programs = await this.repo.findInWorkspace(c, id)
    return {
      headers: c.req.header(),
      payload: {
        id,
        programs,
        ...data,
      },
    }
  }
}
