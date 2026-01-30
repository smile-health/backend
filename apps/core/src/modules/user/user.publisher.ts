import { SyncPublisher } from "@smile-health/lib/base/sync-publisher.js"
import { Publisher } from "@smile-health/lib/rabbitmq/publisher.js"
import { TOPIC } from "@smile-health/lib/rabbitmq/topic.js"
import { Context } from "hono"
import { UserRepository } from "./user.repository"

export class UserPublisher extends SyncPublisher {
  constructor(
    publisher: Publisher,
    private readonly userRepo: UserRepository
  ) {
    super(publisher)
  }

  async processCreate<T>(c: Context, id: number, data: T) {
    const message = await this.buildPayload(c, id, data)
    return await this.publish(TOPIC.USER_CREATED, message)
  }

  async processUpdate<T>(c: Context, id: number, data: T) {
    const message = await this.buildPayload(c, id, data)
    return await this.publish(TOPIC.USER_UPDATED, message)
  }

  async processUpdatePassword<T>(c: Context, id: number, data: T) {
    const message = await this.buildPayload(c, id, data)
    return await this.publish(TOPIC.USER_PASSWORD_UPDATED, message)
  }

  private async buildPayload<T>(c: Context, id: number, data: T) {
    const programs = await this.userRepo.findInWorkspace(c, id)
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
