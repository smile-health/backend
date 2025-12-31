import { SyncPublisher } from "@smile/lib/base/sync-publisher.js"
import { Publisher } from "@smile/lib/rabbitmq/publisher.js"
import { TOPIC } from "@smile/lib/rabbitmq/topic.js"
import { Context } from "hono"
import { ManufactureRepository } from "./manufacture.repository.js"

export class ManufacturePublisher extends SyncPublisher {
  constructor(
    protected readonly publisher: Publisher,
    protected readonly repo: ManufactureRepository
  ) {
    super(publisher)
  }

  async processCreate<T>(c: Context, id: number, data: T): Promise<void> {
    const message = await this.buildPayload(c, id, data)
    await this.publish(TOPIC.MANUFACTURE_CREATED, message)
  }

  async processUpdate<T>(c: Context, id: number, data: T): Promise<void> {
    const message = await this.buildPayload(c, id, data)
    await this.publish(TOPIC.MANUFACTURE_UPDATED, message)
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
