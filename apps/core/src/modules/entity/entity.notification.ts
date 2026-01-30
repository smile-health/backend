import { EntityPublisher } from "./entity.publisher.js"
import {
  NOTIFICATION_TYPE,
  NOTIFICATION_MEDIA,
  NOTIFICATION_WORKER,
} from "@smile-health/lib/rabbitmq/notification.js"
import { Context } from "hono"

export class EntityNotification {
  constructor(private readonly publisher: EntityPublisher) {}

  async setExportNotification(
    c: Context,
    fileUrl: string,
    user,
    entity,
    message: string
  ) {
    const payload = {
      user: {
        user_id: user.id,
        email: user.email,
        mobile_phone: user.mobile_phone,
        fcm_token: user.fcm_token,
        entity_id: user.entity_id,
        province_id: entity.province_id
          ? entity.province_id === ""
            ? null
            : entity.province_id
          : null,
        regency_id: entity.regency_id
          ? entity.regency_id === ""
            ? null
            : entity.regency_id
          : null,
      },
      message: message,
      title: "notification.type.export_large_file",
      type: NOTIFICATION_TYPE.EXPORT_LARGE_FILE,
      download_url: fileUrl,
      worker: NOTIFICATION_WORKER.FIREBASE,
      workerMedia: NOTIFICATION_MEDIA.FIREBASE,
    }

    await this.publisher.processNotification(c, payload)
  }
}
