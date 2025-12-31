import { ENTITY_TYPE } from "@/common/constants/entity.js"
import { DB } from "@/common/infrastructure/database/types/db.js"
import { NotificationTypeRepository } from "@/common/repository/notification-type.js"
import {
  NOTIFICATION_MEDIA,
  NOTIFICATION_TYPE,
} from "@smile/lib/rabbitmq/notification.js"
import { Publisher } from "@smile/lib/rabbitmq/publisher.js"
import { Context } from "@smile/lib/types/context.js"
import { generateEventCode } from "@smile/lib/utils.js"
import { Context as HonoContext } from "hono"
import moment from "moment-timezone"
import { UserRepository } from "../../user/user.repository.js"
import { AssetInventoryRepository } from "../asset-inventory.repository.js"
import {
  DataMessage,
  DataMessageAssetStatusChanged,
  DataMessageWarranty,
} from "../asset-inventory.schema.js"

export class AssetInventoryNotification {
  constructor(
    private assetInventoryRepo: AssetInventoryRepository,
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

  public readonly handleAssetMaintenanceReminder = async (
    c: Context<DB>,
    context: HonoContext
  ) => {
    console.log("=== Start Process Maintenance Reminder ===")
    console.log("Start Process", moment().format("YYYY-MM-DD HH:mm:ss"))

    const limit = 1000
    let offset = 0
    let hasMore = true
    const response = []

    const notifChannel =
      await this.notificationTypeRepo.generateNotificationChannels(
        c,
        NOTIFICATION_TYPE.ASSET_MAINTENANCE
      )

    while (hasMore) {
      const assets = await this.assetInventoryRepo.getAssetReachesMaintenance(
        c,
        limit,
        offset
      )

      if (assets.length === 0) {
        hasMore = false
        console.log("No assets found for maintenance reminder.")
        break
      }

      for (const asset of assets) {
        const {
          serial_number,
          manufacture_name,
          asset_model_name,
          asset_type_name,
          entity_id,
          regency_name,
          entity_type,
          next_maintenance_date,
          days_until_next,
          other_asset_model_name,
          other_asset_manufacture_name,
          other_asset_type_name,
        } = asset
        let { entity_name } = asset

        if (entity_type === ENTITY_TYPE.HEALTH_FACILITY && regency_name) {
          entity_name += ` ${regency_name}`
        }

        const dataMessage: DataMessage = {
          manufacture: manufacture_name || other_asset_manufacture_name,
          asset_type: asset_type_name || other_asset_type_name,
          asset_model: asset_model_name || other_asset_model_name,
          serial_number: serial_number,
          entity_name: entity_name,
          next_schedule: moment(next_maintenance_date)
            .tz("Asia/Jakarta")
            .format("DD/MM/YYYY"),
          days: days_until_next,
        }

        const message = this.TemplateMessageToSend
        message.type = NOTIFICATION_TYPE.ASSET_MAINTENANCE
        message.title = "notification.title.asset_maintenance"
        message.event_code = (await this.getEventCode()) || ""
        if (days_until_next > 0) {
          message.message = "notification.message.asset_maintenance_upcoming"
          message.template = "asset_maintenance_upcoming"
          message.variables = [
            dataMessage.manufacture || "",
            dataMessage.asset_model || "",
            serial_number || "",
            entity_name || "",
            dataMessage.next_schedule || "",
            days_until_next.toString(),
          ]
        } else if (days_until_next < 0) {
          message.message = "notification.message.asset_maintenance_overdue"
          message.template = "asset_maintenance_overdue"
          message.variables = [
            dataMessage.asset_model || "",
            dataMessage.asset_type || "",
            serial_number || "",
            entity_name || "",
            dataMessage.next_schedule || "",
          ]
        }

        response.push(message)

        await this.sendNotifToUser(
          c,
          context,
          entity_id!,
          message,
          dataMessage,
          notifChannel
        )
      }

      offset += limit
    }

    console.log("End Process", moment().format("YYYY-MM-DD HH:mm:ss"))
    console.log("=== End Process Maintenance Reminder ===")

    return response
  }

  public readonly handleAssetCalibrationReminder = async (
    c: Context<DB>,
    context: HonoContext
  ) => {
    console.log("=== Start Process Calibration Reminder ===")
    console.log("Start Process", moment().format("YYYY-MM-DD HH:mm:ss"))

    const limit = 1000
    let offset = 0
    let hasMore = true
    const response = []

    const notifChannel =
      await this.notificationTypeRepo.generateNotificationChannels(
        c,
        NOTIFICATION_TYPE.ASSET_CALIBRATION
      )

    while (hasMore) {
      const assets = await this.assetInventoryRepo.getAssetReachesCalibration(
        c,
        limit,
        offset
      )

      if (assets.length === 0) {
        hasMore = false
        console.log("No assets found for calibration reminder.")
        break
      }

      for (const asset of assets) {
        const {
          serial_number,
          manufacture_name,
          asset_model_name,
          asset_type_name,
          entity_id,
          regency_name,
          entity_type,
          next_calibration_date,
          days_until_next,
          other_asset_model_name,
          other_asset_manufacture_name,
          other_asset_type_name,
        } = asset
        let { entity_name } = asset

        if (entity_type === ENTITY_TYPE.HEALTH_FACILITY && regency_name) {
          entity_name += ` ${regency_name}`
        }

        const dataMessage: DataMessage = {
          manufacture: manufacture_name || other_asset_manufacture_name,
          asset_type: asset_type_name || other_asset_type_name,
          asset_model: asset_model_name || other_asset_model_name,
          serial_number: serial_number,
          entity_name: entity_name,
          next_schedule: moment(next_calibration_date)
            .tz("Asia/Jakarta")
            .format("DD/MM/YYYY"),
          days: days_until_next,
        }

        const message = this.TemplateMessageToSend
        message.type = NOTIFICATION_TYPE.ASSET_CALIBRATION
        message.title = "notification.title.asset_calibration"
        message.event_code = await this.getEventCode()
        if (days_until_next > 0) {
          message.message = "notification.message.asset_calibration_upcoming"
          message.template = "asset_calibration_upcoming"
          message.variables = [
            dataMessage.manufacture || "",
            dataMessage.asset_model || "",
            serial_number || "",
            entity_name || "",
            dataMessage.next_schedule || "",
            days_until_next.toString(),
          ]
        } else if (days_until_next < 0) {
          message.message = "notification.message.asset_calibration_overdue"
          message.template = "asset_calibration_overdue"
          message.variables = [
            dataMessage.asset_model || "",
            dataMessage.asset_type || "",
            serial_number || "",
            entity_name || "",
            dataMessage.next_schedule || "",
          ]
        }

        response.push(message)

        await this.sendNotifToUser(
          c,
          context,
          entity_id!,
          message,
          dataMessage,
          notifChannel
        )
      }

      offset += limit
    }

    return response
  }

  public readonly handleAssetWarrantyReminder = async (
    c: Context<DB>,
    context: HonoContext
  ) => {
    console.log("=== Start Process Warranty Reminder ===")
    console.log("Start Process", moment().format("YYYY-MM-DD HH:mm:ss"))

    const limit = 1000
    let offset = 0
    let hasMore = true
    const response = []

    const notifChannel =
      await this.notificationTypeRepo.generateNotificationChannels(
        c,
        NOTIFICATION_TYPE.ASSET_WARRANTY
      )

    while (hasMore) {
      const assets = await this.assetInventoryRepo.getAssetWarrantyOverdue(
        c,
        limit,
        offset
      )

      if (assets.length === 0) {
        hasMore = false
        console.log("No assets found for warranty reminder.")
        break
      }

      for (const asset of assets) {
        const {
          serial_number,
          manufacture_name,
          asset_model_name,
          entity_id,
          regency_name,
          entity_type,
          warranty_end_date,
        } = asset
        let { entity_name } = asset

        if (entity_type === ENTITY_TYPE.HEALTH_FACILITY && regency_name) {
          entity_name += ` ${regency_name}`
        }

        const dataMessage: DataMessageWarranty = {
          manufacture: manufacture_name || null,
          asset_model: asset_model_name || null,
          serial_number: serial_number || null,
          entity_name: entity_name || null,
          warranty_end_date: moment(warranty_end_date)
            .tz("Asia/Jakarta")
            .format("DD/MM/YYYY"),
        }

        const message = this.TemplateMessageToSend
        message.type = NOTIFICATION_TYPE.ASSET_WARRANTY
        message.title = "notification.title.asset_warranty"
        message.message = "notification.message.asset_warranty"
        message.template = "asset_warranty"
        message.event_code = await this.getEventCode()
        message.variables = [
          dataMessage.manufacture || "",
          dataMessage.asset_model || "",
          serial_number || "",
          entity_name || "",
          dataMessage.warranty_end_date || "",
        ]

        response.push(message)

        await this.sendNotifToUser(
          c,
          context,
          entity_id!,
          message,
          dataMessage,
          notifChannel
        )
      }

      offset += limit
    }

    return response
  }

  public readonly handleAssetChangedNotification = async (
    c: Context<DB>,
    context: HonoContext,
    assetId: number
  ) => {
    const [asset, notifChannel] = await Promise.all([
      this.assetInventoryRepo.getAssetInventoryById(context, assetId),
      this.notificationTypeRepo.generateNotificationChannels(
        c,
        NOTIFICATION_TYPE.ASSET_STATUS_CHANGED
      ),
    ])

    const {
      manufacture_name,
      asset_model_name,
      serial_number,
      entity_id,
      entity_is_puskesmas,
      asset_working_status_name,
      updated_at,
      regency_name,
    } = asset || {}
    let { entity_name } = asset || {}

    const other_manufacture_name = asset?.other_asset_manufacture_name
    const other_asset_model_name = asset?.other_asset_model_name

    if (entity_is_puskesmas && regency_name) entity_name += ` ${regency_name}`
    const dataMessage: DataMessageAssetStatusChanged = {
      manufacture: manufacture_name || other_manufacture_name || "",
      asset_model: asset_model_name || other_asset_model_name || "",
      serial_number: serial_number || "",
      entity_name: entity_name || "",
      status: asset_working_status_name || "",
      updated_at: updated_at
        ? moment(updated_at).tz("Asia/Jakarta").format("DD/MM/YYYY HH:mm")
        : "",
    }
    const message = this.TemplateMessageToSend
    message.type = "asset-status-changed"
    message.title = "notification.title.asset_status_changed"
    message.message = "notification.message.asset_status_changed"
    message.template = "asset_status_changed"
    message.event_code = (await this.getEventCode()) || ""
    message.variables = [
      dataMessage.manufacture || "",
      dataMessage.asset_model || "",
      dataMessage.serial_number || "",
      dataMessage.entity_name || "",
      this.setMessage(context.var.t, asset_working_status_name || "") || "",
      dataMessage.updated_at || "",
    ]

    await this.sendNotifToUser(
      c,
      context,
      entity_id!,
      message,
      dataMessage,
      notifChannel
    )
  }

  private readonly sendNotifToUser = async (
    c: Context<DB>,
    context: HonoContext,
    entityId: number,
    message,
    dataMessage,
    notifChannel: { media: string; worker: string }[]
  ) => {
    const [userEntities, userVendors] = await Promise.all([
      this.userRepo.getUserByEntityId(c, entityId),
      this.userRepo.getUserVendorByCustomerId(c, entityId),
    ])
    console.log(userEntities.length, "userEntities found")
    console.log(userVendors.length, "userVendors found")

    for (const user of [...userEntities, ...userVendors]) {
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

          await this.publisher.publishNotification(
            context,
            payload.worker,
            payload
          )
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
