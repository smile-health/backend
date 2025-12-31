import { SyncPublisher } from "@smile/lib/base/sync-publisher.js"
import { Publisher } from "@smile/lib/rabbitmq/publisher.js"
import { TOPIC } from "@smile/lib/rabbitmq/topic.js"
import { Context } from "hono"
import { EntityRepository } from "../entity/entity.repository.js"
import { SubmitEntityActivitiesRequest } from "./entity-activity.schema.js"

export class EntityActivityPublisher extends SyncPublisher {
  constructor(
    protected readonly publisher: Publisher,
    protected readonly repo: EntityRepository
  ) {
    super(publisher)
  }

  async processUpdate(
    c: Context,
    req: SubmitEntityActivitiesRequest
  ): Promise<void> {
    const entityWorkspaces = await this.repo.find(c, { id: req.entity_id })
    if (entityWorkspaces.length === 0) {
      return
    }

    const payload = entityWorkspaces.map((entityWorkspace) => {
      return {
        ...entityWorkspace,
        ...req,
      }
    })

    c.addEvent(TOPIC.ENTITY_UPDATED, {
      headers: c.req.header(),
      payload: payload,
    })
  }
}
