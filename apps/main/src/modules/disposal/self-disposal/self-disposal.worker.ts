import { DB } from "@/common/infrastructure/database/types/db.js"
import { Consumer } from "@smile-health/lib/rabbitmq/consumer.js"
import { TOPIC } from "@smile-health/lib/rabbitmq/topic.js"
import { CustomContext } from "@smile-health/lib/types/context.js"
import { SelfDisposalRepository } from "./self-disposal.repository.js"

// Define the structure of the message payload
type DisposalCreatedPayload = {
  id: number
  // Add other relevant properties from the disposal event
}

export class SelfDisposalWorker {
  constructor(private readonly repo: SelfDisposalRepository) {}

  public registerWorkers(consumer: Consumer<DB>) {
    consumer.route(TOPIC.DISPOSAL_CREATED, async (c, msg) => {
      const { payload } = JSON.parse(msg ?? "{}") as {
        payload: DisposalCreatedPayload[]
      }

      for (const disposal of payload) {
        await this.syncToClickhouse(c, disposal)
      }
    })
  }

  private async syncToClickhouse(
    c: CustomContext<DB>,
    payload: DisposalCreatedPayload
  ) {
    // TODO: Implement the logic to sync data to Clickhouse
    console.log("Syncing to Clickhouse:", payload)
    console.log(c, this.repo)
    return
  }
}
