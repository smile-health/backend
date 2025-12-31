import { SyncPublisher } from "@smile/lib/base/sync-publisher.js"
import { Publisher } from "@smile/lib/rabbitmq/publisher.js"
import { TOPIC } from "@smile/lib/rabbitmq/topic.js"
import { Context } from "hono"
import { TransactionRepository } from "../transaction/transaction.repository.js"

export class TransactionTransferStockPublisher extends SyncPublisher {
  constructor(
    publisher: Publisher,
    private readonly repo: TransactionRepository
  ) {
    super(publisher)
  }

  async processCreate(
    c: Context,
    messages: {
      id: number
    }[]
  ) {
    if (messages.length === 0) return

    const message = {
      payload: messages,
    }

    c.addEvent(TOPIC.TRANSACTION_CREATED, message)
  }
}
