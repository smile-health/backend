/* eslint-disable @typescript-eslint/no-explicit-any */

import { db } from "@/common/infrastructure/database/index.js"
import { getConnection } from "@/common/infrastructure/mq/index.js"
import { Publisher } from "@smile/lib/rabbitmq/publisher.js"
import { TOPIC } from "@smile/lib/rabbitmq/topic.js"

interface IntegrationLog {
  order_status_id: number
  id: number
  source_id: number | null
  request: string | null
}

export async function retryValidateOrder(orderIds: number[]) {
  const publisher = new Publisher(getConnection)

  // Query integration logs joined with ws_orders with given conditions
  const logs: IntegrationLog[] = await db
    .selectFrom("integration_logs as x")
    .innerJoin("ws_orders as wo", "x.source_id", "wo.id")
    .select(["wo.order_status_id", "wo.id", "x.source_id", "x.request"])
    .where("x.response", "like", "%nilai variabel smile_jml_validated%")
    .where("x.tag", "=", "validate_order")
    .where("x.source_id", "in", orderIds)
    .where("wo.order_status_id", "!=", 6)
    .groupBy("x.source_id")
    .execute()

  for (const log of logs) {
    try {
      const body = (log.request as any).body
      const smile_pesan = body.smile_pesan || ""
      const no_surat = body.no_surat || ""

      const payload = {
        order_id: log.source_id,
        letter_number: no_surat,
        comment: smile_pesan,
      }

      // Publish to RabbitMQ with the required topic and payload
      await publisher.publish(TOPIC.ORDER_STATUS_ORDER_VALIDATED, { payload })
      console.log(`Published message for order_id ${log.source_id}`)
    } catch (error) {
      console.error(
        `Failed processing log with source_id ${log.source_id}:`,
        error
      )
    }
  }

  console.log(`Processed ${logs.length} integration logs.`)
  // process.exit(0)
}
