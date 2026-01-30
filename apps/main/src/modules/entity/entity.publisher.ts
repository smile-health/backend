import { SyncPublisher } from "@smile-health/lib/base/sync-publisher.js"
import { Publisher } from "@smile-health/lib/rabbitmq/publisher.js"
import { TOPIC } from "@smile-health/lib/rabbitmq/topic.js"
import { Context } from "hono"
import { EntityRepository } from "./entity.repository.js"
import { GetEntitiesQueries } from "./entity.schema.js"

export class EntityPublisher extends SyncPublisher {
  constructor(
    protected readonly publisher: Publisher,
    protected readonly repo: EntityRepository
  ) {
    super(publisher)
  }

  async processUpdate(
    c: Context,
    id: number,
    req: { is_vendor?: number; status?: number }
  ): Promise<void> {
    const entities = await this.repo.find(c, { id })

    if (entities.length === 0) {
      return
    }

    const message = {
      headers: c.req.header(),
      payload: entities.map((entity) => ({
        ...entity,
        ...req,
      })),
    }

    await this.publish(TOPIC.ENTITY_UPDATED, message)
  }

  async processExport(c: Context, params: GetEntitiesQueries, options: object) {
    const message = {
      headers: c.req.header(),
      payload: {
        params,
        options,
        language: c.var.language,
        // Additional Payload
        config: c.var.config,
      },
    }
    await this.publish(TOPIC.ENTITY_PROGRAM_EXPORTED, message)
  }
}
