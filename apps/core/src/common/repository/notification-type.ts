import { DB } from "../infrastructure/database/types/db.js"
import {
  NOTIFICATION_MEDIA,
  NOTIFICATION_WORKER,
} from "@smile/lib/rabbitmq/notification.js"
import { Context } from "@smile/lib/types/context.js"

export class NotificationTypeRepository {
  async generateNotificationChannels(c: Context<DB>, type: string) {
    const result = await c.var.trx
      .selectFrom("notification_types")
      .where("type", "=", type)
      .select(["whatsapp_enabled", "fcm_enabled", "email_enabled"])
      .executeTakeFirst()

    const notifChannel: { media: string; worker: string }[] = []
    if (result && result.whatsapp_enabled === 1) {
      notifChannel.push({
        media: NOTIFICATION_MEDIA.WHATSAPP,
        worker: NOTIFICATION_WORKER.WHATSAPP,
      })
    }

    if (result && result.fcm_enabled === 1) {
      notifChannel.push({
        media: NOTIFICATION_MEDIA.FIREBASE,
        worker: NOTIFICATION_WORKER.FIREBASE,
      })
    }

    if (result && result.email_enabled === 1) {
      notifChannel.push({
        media: NOTIFICATION_MEDIA.EMAIL,
        worker: NOTIFICATION_WORKER.EMAIL,
      })
    }

    return notifChannel
  }
}
