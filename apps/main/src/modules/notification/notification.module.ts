import { NotificationTypeRepository } from "@/common/repository/notification-type.js"
import {
  NOTIFICATION_MEDIA,
  NOTIFICATION_TYPE,
  NOTIFICATION_WORKER,
} from "@smile/lib/rabbitmq/notification.js"
import { Publisher } from "@smile/lib/rabbitmq/publisher.js"
import { PaginatedResponse } from "@smile/lib/types/paginate.js"
import { generateEventCode } from "@smile/lib/utils.js"
import { Context } from "hono"
import { BaseModule } from "../base.module.js"
import { PatientCron } from "../transaction/patient/patient.cron.js"
import { PatientRepository } from "../transaction/patient/patient.repository.js"
import { UserRepository } from "../user/user.repository.js"
import { NotificationRepository } from "./notification.repository.js"
import {
  StockBackToNormalData,
  StockBackToNormalRequestType,
  StopNotificationReasonPaginatedRequestType,
  StopNotificationRequestType,
  TriggerPatientReminderNotificationQueries,
} from "./notification.schema.js"

export class NotificationModule extends BaseModule {
  constructor(
    private readonly repo: NotificationRepository,
    private readonly userRepo: UserRepository,
    private readonly patientRepo: PatientRepository,
    protected readonly publisher: Publisher,
    private readonly notificationTypeRepo: NotificationTypeRepository
  ) {
    super()
  }

  async processStockBackToNormal(
    c: Context,
    data: StockBackToNormalRequestType
  ): Promise<boolean> {
    const { entity_id, material_id, activity_id, old_stock } = data

    const stockData = await this.repo.getStockBackToNormalData(
      c,
      entity_id,
      material_id,
      activity_id
    )

    if (!stockData) {
      return false
    }

    const wasStockBelowMinimum = old_stock < stockData.min_stock
    const isStockNowAboveOrEqualMinimum =
      stockData.current_stock >= stockData.min_stock

    if (!wasStockBelowMinimum || !isStockNowAboveOrEqualMinimum) {
      return false
    }

    await this.sendStockBackToNormalNotification(c, stockData)
    return true
  }

  private async sendStockBackToNormalNotification(
    c: Context,
    stockData: StockBackToNormalData
  ): Promise<void> {
    const {
      entity_id,
      material_name,
      material_consumption_unit,
      material_type_id,
      customer_entity_name,
      current_stock,
      regency_name,
      is_fasyankes,
    } = stockData

    const [userEntities, userVendors, notifChannel] = await Promise.all([
      this.userRepo.getUserByEntityId(c, entity_id),
      this.userRepo.getUserVendorByCustomerId(c, entity_id),
      this.notificationTypeRepo.generateNotificationChannels(
        c,
        NOTIFICATION_TYPE.STOCK_BACK_TO_NORMAL
      ),
    ])

    const users = [...userEntities, ...userVendors]
    if (users.length === 0) {
      return
    }

    const notificationVariables = [
      material_name,
      material_consumption_unit,
      is_fasyankes && regency_name
        ? `${customer_entity_name} ${regency_name.toUpperCase()}`
        : customer_entity_name,
      `${current_stock}`,
    ]

    const notificationTemplate = {
      event_code: await generateEventCode(),
      title: "notification.title.stock_back_to_normal",
      message: `notification.message.stock_back_to_normal, ${JSON.stringify({
        material_name: notificationVariables[0],
        material_consumption_unit: notificationVariables[1],
        customer_entity_name: notificationVariables[2],
        current_stock: notificationVariables[3],
        material_type_id: material_type_id,
      })}`, // web notification
      type: NOTIFICATION_TYPE.STOCK_BACK_TO_NORMAL,
      template: NOTIFICATION_TYPE.STOCK_BACK_TO_NORMAL.replaceAll("-", "_"), // whatsapp notification
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
          titleTranslation: this.publisher.setMessage(
            c,
            notificationTemplate.title
          ), // firebase notification
          messageTranslation: this.publisher.setMessage(
            c,
            notificationTemplate.message
          ), // firebase notification
        }

        if (
          (mw.media === NOTIFICATION_MEDIA.WHATSAPP && !user.mobile_phone) ||
          (mw.media === NOTIFICATION_MEDIA.FIREBASE && !user.fcm_token) ||
          (mw.media === NOTIFICATION_MEDIA.EMAIL && !user.email)
        ) {
          // Will skip process if payload not fulfilled
          continue
        } else {
          await this.publisher.publishNotification(c, payload.worker, payload)
        }
      }
    }
  }

  async getStopNotificationReasons(
    c: Context,
    params: StopNotificationReasonPaginatedRequestType
  ) {
    const result = await this.repo.getStopNotificationReasons(c, params)

    if (!result.data.length) {
      return new PaginatedResponse(params, result.data, result.total)
    }

    const reasons = result.data.map((el) => ({
      ...el,
      title: c.var.t(`stop_notification_reason.label.${el.title}`),
    }))

    return new PaginatedResponse(params, reasons, result.total)
  }

  async stopNotification(c: Context, data: StopNotificationRequestType) {
    await this.repo.stopNotification(
      c,
      data.consumption_id,
      data.reason_id,
      c.var.userId!
    )

    await this.publisher.publishNotification(
      c,
      NOTIFICATION_WORKER.STOP_NOTIFICATION,
      { notification_id: data.notification_id }
    )
  }

  async triggerPatientReminderNotification(
    c: Context,
    params: TriggerPatientReminderNotificationQueries
  ) {
    const patientCron = new PatientCron(
      this.patientRepo,
      this.userRepo,
      this.publisher,
      this.notificationTypeRepo
    )

    await patientCron.handleReminderNotif(c, c, c.var.t, params.entity_ids)

    return {
      message: "Patient reminder notification process completed successfully",
    }
  }
}
