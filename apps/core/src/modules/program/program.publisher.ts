import { SyncPublisher } from "@smile-health/lib/base/sync-publisher.js"
import { Publisher } from "@smile-health/lib/rabbitmq/publisher.js"
import { TOPIC } from "@smile-health/lib/rabbitmq/topic.js"
import { Context } from "hono"
import { ProgramRepository } from "./program.repository.js"

export class ProgramPublisher extends SyncPublisher {
  constructor(
    protected readonly publisher: Publisher,
    protected readonly repo: ProgramRepository
  ) {
    super(publisher)
  }

  async processCreate(c: Context, id: number): Promise<void> {
    const program = await this.repo.findDetail(c, id)
    if (program) {
      const message = {
        headers: c.req.header(),
        payload: {
          id: program.id,
          name: program.name,
          config: program.config,
        },
      }

      await this.publish(TOPIC.PROGRAM_CREATED, message)
    }
  }
}
