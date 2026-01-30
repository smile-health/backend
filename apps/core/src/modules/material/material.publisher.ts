import { SyncPublisher } from "@smile-health/lib/base/sync-publisher.js"
import { Publisher } from "@smile-health/lib/rabbitmq/publisher.js"
import { TOPIC } from "@smile-health/lib/rabbitmq/topic.js"
import { Context } from "hono"
import { MaterialRepository } from "./material.repository.js"

export class MaterialPublisher extends SyncPublisher {
  constructor(
    protected readonly publisher: Publisher,
    protected readonly repo: MaterialRepository
  ) {
    super(publisher)
  }

  async processCreate(c: Context, id: number): Promise<void> {
    const materialWorkspaces = await this.repo.findInWorkspace(c, id)

    if (materialWorkspaces && materialWorkspaces.length > 0) {
      const message = {
        headers: c.req.header(),
        payload: materialWorkspaces,
      }

      await this.publish(TOPIC.MATERIAL_CREATED, message)
    }
  }

  async processUpdate(c: Context, id: number): Promise<void> {
    const materialWorkspaces = await this.repo.findInWorkspace(c, id)

    if (materialWorkspaces && materialWorkspaces.length > 0) {
      const message = {
        headers: c.req.header(),
        payload: materialWorkspaces,
      }

      await this.publish(TOPIC.MATERIAL_UPDATED, message)
    }
  }
}
