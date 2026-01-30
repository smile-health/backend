import { SyncPublisher } from "@smile-health/lib/base/sync-publisher.js"
import { Publisher } from "@smile-health/lib/rabbitmq/publisher.js"
import { TOPIC } from "@smile-health/lib/rabbitmq/topic.js"
import { Context } from "hono"
import { MaterialRepository } from "./material.repository.js"
import { UpdateMaterialRequest } from "./material.schema.js"

export class MaterialPublisher extends SyncPublisher {
  constructor(
    protected readonly publisher: Publisher,
    protected readonly repo: MaterialRepository
  ) {
    super(publisher)
  }

  async processUpdate(
    c: Context,
    id: number,
    req: UpdateMaterialRequest
  ): Promise<void> {
    const materialWorkspaces = await this.repo.find(c, { id })

    if (materialWorkspaces && materialWorkspaces.length > 0) {
      const payload = materialWorkspaces.map((materialWorkspace) => {
        return {
          ...req,
          ...materialWorkspace,
        }
      })

      const message = {
        headers: c.req.header(),
        payload: payload,
      }

      c.addEvent(TOPIC.MATERIAL_UPDATED, message)
    }
  }
}
