import { DB } from "@/common/infrastructure/database/types/db.js"
import { NotificationTypeRepository } from "@/common/repository/notification-type.js"
import { UserRepository } from "@/modules/user/user.repository.js"
import { mask } from "@smile/lib/masking.js"
import {
  NOTIFICATION_MEDIA,
  NOTIFICATION_TYPE,
} from "@smile/lib/rabbitmq/notification.js"
import { Publisher } from "@smile/lib/rabbitmq/publisher.js"
import { Context } from "@smile/lib/types/context.js"
import { generateEventCode } from "@smile/lib/utils.js"
import { Context as HonoContext } from "hono"
import moment from "moment"
import { doDecrypt } from "../utils/transaction.encryption.js"
import { PatientRepository } from "./patient.repository.js"

export class PatientCron {
  constructor(
    private readonly repo: PatientRepository,
    private readonly userRepo: UserRepository,
    protected readonly publisher: Publisher,
    private readonly notificationTypeRepo: NotificationTypeRepository
  ) {}

  async handleReminderNotif(
    c: Context<DB>,
    context: HonoContext,
    t: (key: string, options?: Record<string, string>) => string,
    entityIds?: number[]
  ): Promise<void> {
    console.log("=== Start Process Patient Reminder Notif ===")
    console.log("Start Process", moment().format("YYYY-MM-DD HH:mm:ss"))

    const limit = 5
    let offset = 0
    let hasMore = true

    while (hasMore) {
      const rows = await this.repo.getPatientsForReminder(
        c,
        limit,
        offset,
        entityIds
      )
      if (rows.length === 0) {
        hasMore = false
        break
      }

      console.log(`Processing ${rows.length} patient reminders`)

      for (const row of rows) {
        const entityId = row.entity_id
        if (!entityId) continue

        const users = await this.userRepo.getUserByEntityId(c, entityId)
        if (!users || users.length === 0) continue

        const notifChannel =
          await this.notificationTypeRepo.generateNotificationChannels(
            c,
            NOTIFICATION_TYPE.PATIENT_REMINDER
          )

        const identity_number = row.identity_number
          ? doDecrypt(row.identity_number)
          : "-"
        const phone_number = row.phone_number
          ? doDecrypt(row.phone_number).replace(/^\+/, "")
          : "-"

        const maskIdentityNumber = mask(identity_number)

        const notificationTemplate = {
          event_code: await generateEventCode(),
          title: `notification.title.patient_reminder, ${JSON.stringify({
            current_sequence: row.current_sequence,
          })}`,
          message: `notification.message.patient_reminder, ${JSON.stringify({
            identity_number: maskIdentityNumber,
            vaccine_method: row.vaccine_method,
            current_sequence: row.current_sequence,
            previous_sequence: row.previous_sequence,
            previous_vaccine_date: row.previous_vaccine_date
              ? row.previous_vaccine_date.toISOString().split("T")[0]
              : "-",
          })}`,
          type: NOTIFICATION_TYPE.PATIENT_REMINDER,
          data: JSON.stringify({
            stop_notification: row.stop_notification,
            consumption_id: row.consumption_id,
            identity_number: maskIdentityNumber,
            whatsapp_message: `https://wa.me/${phone_number}?text=Halo%2C%20kami%20dari%20${encodeURIComponent(row.entity_name || "-")}.%0ABerdasarkan%20catatan%20kami%2C%20Anda%20dengan%20nomor%20identitas%20${encodeURIComponent(identity_number || "-")}%20belum%20menerima%20${encodeURIComponent(row.current_sequence || "-")}%20sejak%20vaksinasi%20terakhir%20${encodeURIComponent(row.previous_sequence || "-")}%20pada%20${encodeURIComponent(row.previous_vaccine_date ? moment(row.previous_vaccine_date).locale("id").format("D MMMM YYYY") : "-")}.%0ASilakan%20datang%20ke%20${encodeURIComponent(row.entity_name || "-")}%20untuk%20melanjutkan%20vaksinasi%20sesuai%20jadwal.%0ATerima%20kasih`,
          }),
        }

        for (const user of users) {
          for (const mw of notifChannel) {
            const payload = {
              user: {
                user_id: user.id,
                email: user.email,
                mobile_phone: user.mobile_phone,
                fcm_token: user.fcm_token,
                entity_id: user.entity_id,
                province_id: user.entity_province_id || null,
                regency_id: user.entity_regency_id || null,
              },
              user_entity_tag_id:
                (user as unknown as { entity_tag_id?: number }).entity_tag_id ||
                null,
              program_id: user.program_id || null,
              ...notificationTemplate,
              media: mw.media,
              worker: mw.worker,
              workerMedia: mw.media,
              titleTranslation: this.setMessage(t, notificationTemplate.title),
              messageTranslation: this.setMessage(
                t,
                notificationTemplate.message
              ),
            }

            if (
              (mw.media === NOTIFICATION_MEDIA.WHATSAPP &&
                !user.mobile_phone) ||
              (mw.media === NOTIFICATION_MEDIA.FIREBASE && !user.fcm_token) ||
              (mw.media === NOTIFICATION_MEDIA.EMAIL && !user.email)
            ) {
              continue
            } else {
              await this.publisher.publishNotification(
                context,
                payload.worker,
                payload
              )
            }
          }
        }
      }

      offset += limit
    }

    console.log("End Process", moment().format("YYYY-MM-DD HH:mm:ss"))
    console.log("=== End Process Patient Reminder Notif ===")
  }

  public setMessage(
    t: (key: string, options?: Record<string, string>) => string,
    data: string
  ) {
    const splitIndex = data.indexOf(", {")
    if (splitIndex === -1) return t(data) || data

    const label = data.slice(0, splitIndex).trim()
    const jsonString = data.slice(splitIndex + 2).trim()

    try {
      const json = JSON.parse(jsonString)

      const transformed = Object.fromEntries(
        Object.entries(json).map(([k, v]) => [
          k,
          typeof v === "string" ? t(v) : v,
        ])
      )

      return t(label, transformed as Record<string, string>)
    } catch {
      return data
    }
  }
}
