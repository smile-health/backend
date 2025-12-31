import { Publisher } from "@smile/lib/rabbitmq/publisher.js"
import { TOPIC } from "@smile/lib/rabbitmq/topic.js"
import { Context } from "hono"
import { env } from "../../config/env.js"
import { StockBackToNormalNotificationPayload } from "./notification.schema.js"

export class NotificationPublisher {
  constructor(protected readonly publisher: Publisher) {}

  async publishStockBackToNormalCheck(
    c: Context,
    entityId: number,
    materialId: number,
    activityId: number,
    oldStock: number
  ): Promise<void> {
    const payload: StockBackToNormalNotificationPayload = {
      url: `${env.APP_URL}${!env.APP_URL.includes("localhost") ? "/main" : ""}/notifications/stock-back-to-normal`,
      method: "POST",
      headers: {
        "x-program-id": c.var.programId || 0,
        "Accept-Language": c.var.language || "id",
        timezone: c.var.timeZone || "Asia/Jakarta",
      },
      data: {
        entity_id: entityId,
        material_id: materialId,
        activity_id: activityId,
        old_stock: oldStock,
      },
    }

    await this.publisher.publishNotification(c, TOPIC.HTTP_WORKER, payload)
  }
}
