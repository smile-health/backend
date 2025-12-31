import { SyncPublisher } from "@smile/lib/base/sync-publisher.js"
import { Publisher } from "@smile/lib/rabbitmq/publisher.js"
import { TOPIC } from "@smile/lib/rabbitmq/topic.js"
import { Context } from "hono"
import { SelfDisposalRepository } from "./self-disposal.repository.js"

export type PublishDisposalDTO = {
  id: number
  // Add any other properties needed for the event payload
}

export class SelfDisposalPublisher extends SyncPublisher {
  constructor(
    publisher: Publisher,
    private readonly repo: SelfDisposalRepository
  ) {
    super(publisher)
  }

  async processCreate(c: Context, messages: PublishDisposalDTO[]) {
    if (messages.length === 0) return

    // Get disposal transaction details for the first transaction
    const details = await this.repo.findDisposalTransactionById(
      c,
      messages[0]?.id ?? 0
    )

    const message = {
      headers: c.req.header(),
      payload: messages.map((trx) => {
        const payload = { ...trx }
        if (details) {
          Object.assign(payload, details)
        }
        return payload
      }),
    }

    c.addEvent(TOPIC.DISPOSAL_CREATED, message)
  }
}
