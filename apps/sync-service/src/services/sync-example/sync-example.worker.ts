import { DB } from "@/common/infrastructure/database/types/db.js"
import { Consumer } from "@smile-health/lib/rabbitmq/consumer.js"
import { TOPIC } from "@smile-health/lib/rabbitmq/topic.js"

export class SyncExampleWorker {
  constructor() {}

  public registerWorkers(consumer: Consumer<DB>): void {
    consumer.route(TOPIC.EXAMPLE_CREATED, (c, msg) => {
      const parseMsg = JSON.parse(msg ?? "{}")
      console.log("SUCCESS CREATED SYNC", parseMsg)
    })

    consumer.route(TOPIC.EXAMPLE_UPDATED, (c, msg) => {
      const parseMsg = JSON.parse(msg ?? "{}")
      console.log("SUCCESS UPDATED SYNC", parseMsg)
    })
  }
}
