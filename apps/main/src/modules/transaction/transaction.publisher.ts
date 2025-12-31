import { SyncPublisher } from "@smile/lib/base/sync-publisher.js"
import { Publisher } from "@smile/lib/rabbitmq/publisher.js"
import { TOPIC } from "@smile/lib/rabbitmq/topic.js"
import { collect } from "@smile/lib/utils.js"
import { Context } from "hono"
import { TransactionRepository } from "./transaction.repository.js"
import {
  PublishTrxDTO,
  TransactionListPaginatedRequestDTO,
} from "./transaction.schema.js"

export class TransactionPublisher extends SyncPublisher {
  constructor(
    publisher: Publisher,
    private readonly repo: TransactionRepository
  ) {
    super(publisher)
  }

  async processCreate(c: Context, messages: PublishTrxDTO[]) {
    if (messages.length === 0) return

    const message = {
      payload: messages,
    }

    c.addEvent(TOPIC.TRANSACTION_CREATED, message)
  }

  async processExport(
    c: Context,
    params: TransactionListPaginatedRequestDTO,
    options: object
  ) {
    const message = {
      headers: c.req.header(),
      payload: {
        params,
        options,
        language: c.var.language,
        // Additional Payload
        config: c.var.config,
        programName: c.var.user!.program_name,
      },
    }

    c.addEvent(TOPIC.TRANSACTION_EXPORTED, message)
  }
}
