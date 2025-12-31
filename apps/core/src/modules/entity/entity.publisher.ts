import { SyncPublisher } from "@smile/lib/base/sync-publisher.js"
import { Publisher } from "@smile/lib/rabbitmq/publisher.js"
import { TOPIC } from "@smile/lib/rabbitmq/topic.js"
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

  async processCreate(c: Context, id: number): Promise<void> {
    const entityWorkspaces = await this.repo.findInWorkspace(c, id)

    if (entityWorkspaces && entityWorkspaces.length > 0) {
      const payload = entityWorkspaces.map((entityWorkspace) => {
        const { ws_id, ...entity } = entityWorkspace
        return {
          ...entity,
          id: ws_id,
          global_id: id,
          is_ayosehat: 0,
        }
      })

      const message = {
        headers: c.req.header(),
        payload: payload,
      }

      await this.publish(TOPIC.ENTITY_CREATED, message)
    }
  }

  async processUpdate(c: Context, id: number): Promise<void> {
    const entityWorkspaces = await this.repo.findInWorkspace(c, id)

    if (entityWorkspaces && entityWorkspaces.length > 0) {
      const payload = entityWorkspaces.map((entityWorkspace) => {
        return {
          ...entityWorkspace,
          id: entityWorkspace.ws_id,
          global_id: id,
        }
      })

      const message = {
        headers: c.req.header(),
        payload: payload,
      }

      await this.publish(TOPIC.ENTITY_UPDATED, message)
    }
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

    await this.publish(TOPIC.ENTITY_EXPORTED, message)
  }

  async processNotification(c: Context, payload) {
    payload.messageTranslation = this.publisher.setMessage(c, payload.message)
    await this.publisher.publishNotification(c, payload.worker, payload)
  }
}
