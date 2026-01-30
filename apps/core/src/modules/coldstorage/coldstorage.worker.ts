import { DB } from "@/common/infrastructure/database/types/db.js"
import { Consumer } from "@smile-health/lib/rabbitmq/consumer.js"
import { TOPIC } from "@smile-health/lib/rabbitmq/topic.js"
import { BaseWorker } from "../base.worker.js"
import { ColdstorageModule } from "./coldstorage.module.js"

export class ColdstorageWorker extends BaseWorker {
  constructor(private readonly module: ColdstorageModule) {
    super()
  }

  public registerWorkers(consumer: Consumer<DB>) {
    consumer.route(TOPIC.CREATED_COLDSTORAGE, async (c, msg) => {
      const parseMsg = JSON.parse(msg ?? "{}")
      const { entity_id, program_id, material_ids, user_id } = parseMsg.payload

      await this.module.bulkCreate(c, {
        entity_id,
        program_id,
        material_ids,
        user_id,
      })
    })
  }
}
