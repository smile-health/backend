import { DB } from "@/common/infrastructure/database/types/db.js"
import { Context } from "@smile/lib/types/context.js"
import { StockRepository } from "./stock.repository.js"
import { UserRepository } from "../user/user.repository.js"
import moment from "moment-timezone"
import { DataMessage, stockNotif } from "./stock.schema.js"
import {
  NOTIFICATION_MEDIA,
  NOTIFICATION_TYPE,
} from "@smile/lib/rabbitmq/notification.js"
import { Publisher } from "@smile/lib/rabbitmq/publisher.js"
import { EntityCustomerRepository } from "../entity-customer/entity-customer.repository.js"
import { NotificationTypeRepository } from "@/common/repository/notification-type.js"
import { Context as HonoContext } from "hono"
import { generateEventCode } from "@smile/lib/utils.js"
import { TFunction } from "i18next"

export class StockCron {
  constructor(
    private readonly repo: StockRepository,
    private readonly userRepo: UserRepository,
    private readonly entityCustomerRepo: EntityCustomerRepository,
    private readonly notificationTypeRepo: NotificationTypeRepository,
    protected readonly publisher: Publisher
  ) {}

  public readonly handleNotifEdStock = async (
    c: Context<DB>,
    context: HonoContext,
    t: string | TFunction<"translation", undefined>,
    entityIds?: number[]
  ) => {
    // 1, 3, 10, 14, 30, 60, or 90 days before the expiration date
    console.log("=== Start Process Expired Date Stock Notif ===")
    console.log("Start Process", moment().format("YYYY-MM-DD HH:mm:ss"))

    const limit = 1000
    let offset = 0
    let hasMore = true

    while (hasMore) {
      const stocks = await this.repo.getStockExpired(
        c,
        limit,
        offset,
        entityIds
      )
      if (stocks.length === 0) {
        hasMore = false
        break
      }

      for (const stock of stocks) {
        const {
          entity_id,
          material_name,
          material_consumption_unit,
          customer_entity_name,
          batch_number,
          current_stock,
          regency_name,
          number_of_days,
          material_type_id,
        } = stock

        const dataMessage = {
          material_name,
          material_consumption_unit,
          batch_number,
          current_stock,
          customer_entity_name,
          regency_name,
          number_of_days,
          material_type_id,
        }
        const message = this.TemplateMessageToSend
        message.event_code = await generateEventCode()
        message.title = "notification.title.expired_date_stock"
        message.type = `ed-${number_of_days}`
        message.template = "expiry_date"
        message.message = "notification.message.expired_date_stock"
        message.variables = [
          material_name ?? "",
          material_consumption_unit ?? "",
          batch_number ?? "",
          new Intl.NumberFormat("id-ID").format(Number(current_stock)),
          `${customer_entity_name ?? ""} ${regency_name ?? ""}`,
          `${number_of_days}`,
        ]

        const notifChannel =
          await this.notificationTypeRepo.generateNotificationChannels(
            c,
            `ed-${number_of_days}`
          )

        await this.sendNotifToUser(
          c,
          context,
          t,
          entity_id!,
          message,
          dataMessage,
          notifChannel
        )
      }

      offset += limit
    }

    console.log("End Process", moment().format("YYYY-MM-DD HH:mm:ss"))
    console.log("=== End Process Expired Date Stock Notif ===")
  }

  public readonly handleNotifStock = async (
    c: Context<DB>,
    context: HonoContext,
    t: string | TFunction<"translation", undefined>,
    isHierarchy = true,
    entityIds?: number[]
  ) => {
    console.log("=== Start Process Great Less Stock Notif ===")
    console.log("Start Process", moment().format("YYYY-MM-DD HH:mm:ss"))

    const limit = 1000
    let offset = 0
    let hasMore = true

    while (hasMore) {
      const stocks = await this.repo.getEntityMaterialActivityMinMax(
        c,
        limit,
        offset,
        isHierarchy,
        entityIds
      )

      if (stocks.length === 0) {
        hasMore = false
        break
      }

      for (const stock of stocks) {
        await this.conditionStockNotif(c, context, t, stock, isHierarchy)
      }

      offset += limit
    }

    console.log("End Process", moment().format("YYYY-MM-DD HH:mm:ss"))
    console.log("=== End Process Great Less Stock Notif ===")
  }

  private readonly TemplateMessageToSend = {
    event_code: "",
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
  }

  private readonly vendorCodeByIsHierarchy = {
    0: "00",
    1: "95_01",
  }

  private async customerToVendor(c, user) {
    const isHierarchy = user.program_config.material.is_hierarchy || false
    const entityType = user.entity_type
    const vendorCode = (isHierarchy) =>
      isHierarchy
        ? this.vendorCodeByIsHierarchy[1]
        : this.vendorCodeByIsHierarchy[0]
    if (entityType === 1) {
      return this.entityCustomerRepo.getVendorByCustomerId(
        c,
        user.entity_id,
        0,
        vendorCode(isHierarchy)
      )
    } else if (entityType === 2) {
      return this.entityCustomerRepo.getVendorByCustomerId(c, user.entity_id, 1)
    } else if (entityType === 3) {
      return this.entityCustomerRepo.getVendorByCustomerId(c, user.entity_id, 2)
    }

    return { vendor_name: "" }
  }

  private async buildMessageForUser(c, user, baseMessage, dataMessage) {
    if (
      baseMessage.type === NOTIFICATION_TYPE.ZERO_STOCK &&
      user.is_vendor === 1 &&
      !baseMessage.message.endsWith("_vendor")
    ) {
      baseMessage.message = `${baseMessage.message}_vendor`
      baseMessage.template = "zero_stock_vendor"
      if (baseMessage.vendorPushed) {
        baseMessage.variables.pop()
        baseMessage.vendorPushed = false
      }
    } else if (
      baseMessage.type === NOTIFICATION_TYPE.ZERO_STOCK &&
      !user.is_vendor
    ) {
      const dataVendor = await this.customerToVendor(c, user)
      const vendorName = dataVendor?.vendor_name || ""
      dataMessage.vendor = vendorName
      if (!baseMessage.vendorPushed) {
        baseMessage.variables.push(vendorName)
        baseMessage.vendorPushed = true
      }
    }

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
      user_entity_tag_id: user.entity_tag_id || null,
      program_id: user.program_id || null,
      message: `${baseMessage.message}, ${JSON.stringify(dataMessage)}`,
    }
  }

  private readonly sendNotifToUser = async (
    c: Context<DB>,
    context: HonoContext,
    t: string | TFunction<"translation", undefined>,
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
      const payload = await this.buildMessageForUser(
        c,
        user,
        message,
        dataMessage
      )

      for (const mw of notifChannel) {
        payload.media = mw.media
        payload.worker = mw.worker
        payload.workerMedia = mw.media
        payload.messageTranslation = this.setMessage(t, payload.message)
        payload.titleTranslation = this.setMessage(t, payload.title)

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

  private readonly conditionStockNotif = async (
    c: Context<DB>,
    context: HonoContext,
    t: string | TFunction<"translation", undefined>,
    stock: stockNotif,
    isHierarchy: boolean
  ) => {
    const {
      entity_id,
      material_id,
      material_name,
      material_consumption_unit,
      customer_entity_name,
      min,
      material_type_id,
      // max,
    } = stock
    const result = await this.repo.getStockOnHandFromEntityMaterialActivity(
      c,
      entity_id,
      material_id,
      isHierarchy
    )
    if (!result || result?.stock_on_hand === null) return false

    const stockOnHand = result.stock_on_hand
    const dataMessage: DataMessage = {
      material_name,
      material_consumption_unit,
      current_stock: stockOnHand,
      customer_entity_name,
      current_date:
        moment(result.updated_at)
          .tz("Asia/Jakarta")
          .format("DD/MM/YYYY HH:mm") + " WIB",
      material_type_id,
    }

    const message = this.TemplateMessageToSend
    message.event_code = await generateEventCode()
    message.vendorPushed = false
    message.variables = []
    let notifChannel: { media: string; worker: string }[] = []
    if (Number(stockOnHand) === 0) {
      message.title = "notification.title.zero_stock"
      message.type = NOTIFICATION_TYPE.ZERO_STOCK
      message.template = "zero_stocks"
      message.message = "notification.message.zero_stock"
      message.variables = [
        material_name ?? "",
        material_consumption_unit ?? "",
        customer_entity_name ?? "",
        dataMessage.current_date,
      ]
      notifChannel =
        await this.notificationTypeRepo.generateNotificationChannels(
          c,
          NOTIFICATION_TYPE.ZERO_STOCK
        )
    } else if (Number(stockOnHand) < Number(min)) {
      message.title = "notification.title.less_stock"
      message.type = NOTIFICATION_TYPE.LESS_STOCK
      message.template = NOTIFICATION_TYPE.LESS_STOCK.replace("-", "_")
      message.message = "notification.message.less_stock"
      message.variables = [
        material_name ?? "",
        material_consumption_unit ?? "",
        new Intl.NumberFormat("id-ID").format(Number(stockOnHand)),
        new Intl.NumberFormat("id-ID").format(Number(min)),
        customer_entity_name ?? "",
        dataMessage.current_date,
      ]
      dataMessage.min_stock = min
      notifChannel =
        await this.notificationTypeRepo.generateNotificationChannels(
          c,
          NOTIFICATION_TYPE.LESS_STOCK
        )
    }
    // else if (Number(stockOnHand) > Number(max)) {
    //   message.title = "notification.title.over_stock"
    //   message.type = NOTIFICATION_TYPE.OVER_STOCK
    //   message.message = "notification.message.over_stock"
    //   dataMessage.max_stock = max
    // }
    else {
      return false // No notification needed
    }

    await this.sendNotifToUser(
      c,
      context,
      t,
      entity_id,
      message,
      dataMessage,
      notifChannel
    )
    return true // Notification sent
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
