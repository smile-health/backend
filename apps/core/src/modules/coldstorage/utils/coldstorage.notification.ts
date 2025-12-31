import { NotificationTypeRepository } from "@/common/repository/notification-type"
import { DB } from "@/common/infrastructure/database/types/db.js"
import { Publisher } from "@smile/lib/rabbitmq/publisher.js"
import { ColdstorageRepository } from "../coldstorage.repository"
import { UserRepository } from "@/modules/user/user.repository"
// import { Context } from "@smile/lib/types/context.js"
import { Context } from "hono"
import {
  NOTIFICATION_MEDIA,
  NOTIFICATION_TYPE,
} from "@smile/lib/rabbitmq/notification"
import { generateEventCode } from "@smile/lib/utils.js"

interface DataMessage {
  entity_name?: string
  percentage_capacity?: string
}

export class ColdstorageNotification {
  constructor(
    private coldstorageRepo: ColdstorageRepository,
    private userRepo: UserRepository,
    private publisher: Publisher,
    private notificationTypeRepo: NotificationTypeRepository
  ) {}

  private readonly TemplateMessageToSend = {
    user: {
      user_id: "",
      email: "",
      mobile_phone: "",
      fcm_token: "",
      entity_id: "",
      province_id: "",
      regency_id: null,
    },
    media: "",
    message: "",
    title: "",
    type: "",
    download_url: null,
    worker: "",
    workerMedia: "",
    program_id: null,
    template: "",
    variables: [] as string[],
    vendorPushed: false,
    event_code: "",
  }

  async handleSendNotificationColdstoragePercentageCapacityMoreThan80(
    c: Context,
    entityId: number
  ) {
    const response: (typeof this.TemplateMessageToSend)[] = []

    const notifChannel =
      await this.notificationTypeRepo.generateNotificationChannels(
        c,
        NOTIFICATION_TYPE.CAPACITY_80
      )

    const coldstorage = await this.coldstorageRepo.geColdstorageById(
      c,
      entityId
    )

    if (!coldstorage) {
      return
    }

    const dataMessage: DataMessage = {
      entity_name: coldstorage?.name || "",
      percentage_capacity: coldstorage?.percentage_capacity?.toString() || "",
    }

    const message = this.TemplateMessageToSend
    message.type = NOTIFICATION_TYPE.CAPACITY_80
    message.title = "notification.type.capacity_80"
    message.event_code = (await this.getEventCode()) || ""
    message.message = "notification.message.capacity_80"
    message.template = "capacity_80"
    message.variables = [
      dataMessage.entity_name || "",
      dataMessage.percentage_capacity || "",
    ]

    response.push(message)

    await this.sendNotifToUser(c, entityId, message, dataMessage, notifChannel)
  }

  private readonly sendNotifToUser = async (
    // c: Context<DB>,
    c: Context,
    entityId: number,
    message,
    dataMessage,
    notifChannel: { media: string; worker: string }[]
  ) => {
    const [userEntities, userSuperAdmin] = await Promise.all([
      this.userRepo.getUserByEntityId(c, entityId),
      this.userRepo.getUserSuperAdmin(c),
    ])

    const seenIds = new Set(userEntities.map((u) => u.id))
    const uniqueSuperAdmins = userSuperAdmin.filter((u) => !seenIds.has(u.id))
    const combinedUsers = [...userEntities, ...uniqueSuperAdmins]

    for (const user of [...combinedUsers]) {
      const payload = await this.buildMessageForUser(user, message, dataMessage)
      for (const mw of notifChannel) {
        if (
          (mw.media === NOTIFICATION_MEDIA.WHATSAPP && !user.mobile_phone) ||
          (mw.media === NOTIFICATION_MEDIA.FIREBASE && !user.fcm_token) ||
          (mw.media === NOTIFICATION_MEDIA.EMAIL && !user.email)
        ) {
          // Will skip process if payload not fulfilled
          continue
        } else {
          payload.media = mw.media
          payload.worker = mw.worker
          payload.workerMedia = mw.media
          payload.messageTranslation = this.setMessage(c.var.t, payload.message)
          payload.titleTranslation = this.setMessage(c.var.t, payload.title)

          await this.publisher.publishNotification(c, payload.worker, payload)
        }
      }
    }
  }

  private async buildMessageForUser(user, baseMessage, dataMessage) {
    return {
      ...baseMessage,
      user: {
        user_id: user.id,
        email: user.email,
        mobile_phone: user.mobile_phone,
        fcm_token: user.fcm_token,
        entity_id: user.entity_id,
        province_id: user.entity_province_id || null,
        regency_id: user.entity_regency_id || null,
        is_vendor: user.is_vendor,
      },
      program_id: user.program_id || null,
      message: `${baseMessage.message}, ${JSON.stringify(dataMessage)}`,
      user_entity_tag_id: user.entity_tag_id || null,
    }
  }

  private async getEventCode() {
    return (await generateEventCode()) || ""
  }

  public setMessage(t, data: string) {
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

      return t(label, transformed)
    } catch (e) {
      return data
    }
  }
}
