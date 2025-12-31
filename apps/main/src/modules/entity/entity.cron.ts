import { ENTITY_TYPE } from "@/common/constants/entity.js"
import { DB } from "@/common/infrastructure/database/types/db.js"
import {
  NOTIFICATION_MEDIA,
  NOTIFICATION_TYPE,
} from "@smile/lib/rabbitmq/notification.js"
import { Publisher } from "@smile/lib/rabbitmq/publisher.js"
import { Context } from "@smile/lib/types/context.js"
import { generateEventCode } from "@smile/lib/utils.js"
import { Context as HonoContext } from "hono"
import moment from "moment"
import { UserRepository } from "../user/user.repository.js"
import { EntityRepository } from "./entity.repository.js"
import { GetInactiveEntityNotificationQueries } from "./entity.schema.js"
import { NotificationTypeRepository } from "@/common/repository/notification-type.js"

interface InactiveEntityData {
  entity_id: number
  customer_entity_name: string | null
  regency_name: string | null
  inactive_days: number
  is_fasyankes: boolean
}

export class EntityCron {
  constructor(
    private readonly repo: EntityRepository,
    private readonly userRepo: UserRepository,
    protected readonly publisher: Publisher,
    private readonly notificationTypeRepo: NotificationTypeRepository
  ) {}

  async handleInactiveEntityNotif(
    c: Context<DB>,
    context: HonoContext,
    t: (key: string, options?: Record<string, string>) => string,
    query?: GetInactiveEntityNotificationQueries
  ): Promise<void> {
    console.log("=== Start Process Inactive Entity Notif ===")
    console.log("Start Process", moment().format("YYYY-MM-DD HH:mm:ss"))

    const limit = 5
    let offset = 0
    let hasMore = true

    while (hasMore) {
      const entities = await this.repo.getInactiveHealthcareFacilities(
        c,
        limit,
        offset,
        query?.entity_ids
      )

      if (entities.length === 0) {
        hasMore = false
        break
      }

      console.log(`Processing ${entities.length} inactive entities`)

      for (const entity of entities) {
        if (entity.customer_entity_name) {
          const entityData: InactiveEntityData = {
            entity_id: entity.entity_id,
            customer_entity_name: entity.customer_entity_name,
            regency_name: entity.regency_name,
            inactive_days: entity.inactive_days,
            is_fasyankes: entity.entity_type_id === ENTITY_TYPE.FASKES,
          }

          await this.sendInactiveEntityNotification(c, context, t, entityData)
        }
      }

      offset += limit
    }

    console.log("End Process", moment().format("YYYY-MM-DD HH:mm:ss"))
    console.log("=== End Process Inactive Entity Notif ===")
  }

  private async sendInactiveEntityNotification(
    c: Context<DB>,
    context: HonoContext,
    t: (key: string, options?: Record<string, string>) => string,
    entityData: InactiveEntityData
  ): Promise<void> {
    const {
      entity_id,
      customer_entity_name,
      regency_name,
      inactive_days,
      is_fasyankes,
    } = entityData

    const [userEntities, userVendors, notifChannel] = await Promise.all([
      this.userRepo.getUserByEntityId(c, entity_id),
      this.userRepo.getUserVendorByCustomerId(c, entity_id),
      this.notificationTypeRepo.generateNotificationChannels(
        c,
        NOTIFICATION_TYPE.INACTIVE_ENTITY
      ),
    ])

    const users = [...userEntities, ...userVendors]
    if (users.length === 0) {
      return
    }

    const notificationVariables = [
      is_fasyankes && regency_name
        ? `${customer_entity_name} ${regency_name.toUpperCase()}`
        : customer_entity_name,
      `${inactive_days}`,
    ]

    const notificationTemplate = {
      event_code: await generateEventCode(),
      title: "notification.title.inactive_entity",
      message: `notification.message.inactive_entity, ${JSON.stringify({
        customer_entity_name: notificationVariables[0],
        inactive_days: notificationVariables[1],
      })}`, // web notification
      type: NOTIFICATION_TYPE.INACTIVE_ENTITY,
      template: NOTIFICATION_TYPE.INACTIVE_ENTITY.replaceAll("-", "_"), // whatsapp notification
      variables: notificationVariables, // whatsapp notification
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
          user_entity_tag_id: user.entity_tag_id || null,
          program_id: user.program_id || null,
          ...notificationTemplate,
          media: mw.media,
          worker: mw.worker,
          workerMedia: mw.media,
          titleTranslation: this.setMessage(t, notificationTemplate.title), // firebase notification
          messageTranslation: this.setMessage(t, notificationTemplate.message), // firebase notification
        }

        if (
          (mw.media === NOTIFICATION_MEDIA.WHATSAPP && !user.mobile_phone) ||
          (mw.media === NOTIFICATION_MEDIA.FIREBASE && !user.fcm_token) ||
          (mw.media === NOTIFICATION_MEDIA.EMAIL && !user.email)
        ) {
          // Will skip process if payload not fulfilled
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
