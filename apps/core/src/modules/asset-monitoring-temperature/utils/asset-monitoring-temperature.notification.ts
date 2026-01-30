import { DB } from "@/common/infrastructure/database/types/db.js"
import { NotificationTypeRepository } from "@/common/repository/notification-type.js"
import {
  NOTIFICATION_MEDIA,
  NOTIFICATION_TYPE,
} from "@smile-health/lib/rabbitmq/notification.js"
import { Publisher } from "@smile-health/lib/rabbitmq/publisher.js"
import { Context } from "@smile-health/lib/types/context.js"
import { generateEventCode } from "@smile-health/lib/utils.js"
import { Context as HonoContext } from "hono"
import moment from "moment-timezone"
import { UserRepository } from "../../user/user.repository.js"
import { AssetMonitoringTemperatureRepository } from "./asset-monitoring-temperature.repository.js"
import tracedRedis, {
  redis as originalRedis,
} from "@/common/infrastructure/redis.js"

interface NotificationRecord {
  rtmd_id: number
  last_notification_abnormal_type?: "below" | "above"
  last_notification_time?: Date
}

const CACHE_KEY_PREFIX = "asset_monitoring_temperature:notification:"
const CACHE_TTL = 60 * 60 * 24

class NotificationCache {
  static async get(rtmdId: number): Promise<NotificationRecord | null> {
    try {
      const data = await tracedRedis.get(`${CACHE_KEY_PREFIX}${rtmdId}`)
      if (!data) return null

      const parsed = JSON.parse(data as string)
      if (parsed.last_notification_time) {
        parsed.last_notification_time = new Date(parsed.last_notification_time)
      }
      return parsed as NotificationRecord
    } catch (error) {
      console.error(
        `Error getting notification cache for RTMD ${rtmdId}:`,
        error
      )
      return null
    }
  }

  static async set(rtmdId: number, record: NotificationRecord): Promise<void> {
    try {
      const key = `${CACHE_KEY_PREFIX}${rtmdId}`
      const data = JSON.stringify(record)
      await originalRedis.setex(key, CACHE_TTL, data)
    } catch (error) {
      console.error(
        `Error setting notification cache for RTMD ${rtmdId}:`,
        error
      )
    }
  }

  static async del(rtmdId: number): Promise<void> {
    try {
      const key = `${CACHE_KEY_PREFIX}${rtmdId}`
      await tracedRedis.del(key)
    } catch (error) {
      console.error(
        `Error deleting notification cache for RTMD ${rtmdId}:`,
        error
      )
    }
  }

  static async clearAll(): Promise<void> {
    try {
      const keys = await originalRedis.keys(`${CACHE_KEY_PREFIX}*`)
      if (keys.length > 0) {
        await originalRedis.del(...keys)
      }
    } catch (error) {
      console.error("Error clearing notification cache:", error)
    }
  }

  static async getNotificationCacheStatus(): Promise<
    Array<{
      rtmd_id: number
      last_notification_abnormal_type?: "below" | "above"
      last_notification_time?: Date
      cache_key: string
    }>
  > {
    try {
      const keys = await originalRedis.keys(`${CACHE_KEY_PREFIX}*`)
      const status: Array<{
        rtmd_id: number
        last_notification_abnormal_type?: "below" | "above"
        last_notification_time?: Date
        cache_key: string
      }> = []

      for (const key of keys) {
        const data = await tracedRedis.get(key)
        if (data) {
          const parsed = JSON.parse(data as string)
          if (parsed.last_notification_time) {
            parsed.last_notification_time = new Date(
              parsed.last_notification_time
            )
          }
          status.push({
            ...parsed,
            cache_key: key,
          })
        }
      }

      return status
    } catch (error) {
      console.error("Error getting notification cache status:", error)
      return []
    }
  }
}

export class AssetMonitoringTemperatureNotification {
  constructor(
    private assetMonitoringTemperatureRepo: AssetMonitoringTemperatureRepository,
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

  private async getEventCode(): Promise<string> {
    return generateEventCode()
  }

  async checkAndSendTemperatureNotification(
    c: Context<DB>,
    context: HonoContext,
    rtmdId: number,
    assetInventoryId: number,
    assetModelTemperatureCapacityId: number,
    currentTemp: number,
    actualTime: Date
  ): Promise<void> {
    try {
      // Get asset info with other capacity data
      const assetInfo =
        await this.assetMonitoringTemperatureRepo.getAssetInfoByRtmdId(
          c,
          rtmdId
        )

      if (!assetInfo) {
        return
      }

      let thresholdData: unknown
      let minThreshold: number, maxThreshold: number

      // Check if asset has other capacity temperature thresholds
      if (assetInfo.other_min_temperature && assetInfo.other_max_temperature) {
        // Use other capacity thresholds
        minThreshold = assetInfo.other_min_temperature
        maxThreshold = assetInfo.other_max_temperature
      } else {
        // First, get the asset_type_temperature_id for the given capacity
        const capacityQuery = await c.var.trx
          .selectFrom("asset_models_temperatures_capacities")
          .select("asset_type_temperature_id")
          .where("asset_model_id", "=", assetInfo.asset_model_id)
          .where("id", "=", assetModelTemperatureCapacityId)
          .where("deleted_at", "is", null)
          .executeTakeFirst()

        if (!capacityQuery) {
          return
        }

        // Use standard temperature capacity thresholds with the correct asset_type_temperature_id
        thresholdData =
          await this.assetMonitoringTemperatureRepo.getTemperatureThresholdsByAssetModelId(
            c,
            capacityQuery.asset_type_temperature_id,
            null,
            null,
            assetInfo.asset_model_id,
            capacityQuery.asset_type_temperature_id,
            assetModelTemperatureCapacityId
          )

        if (
          !thresholdData ||
          !Array.isArray(thresholdData) ||
          thresholdData.length === 0
        ) {
          return
        }

        const threshold = thresholdData[0]
        minThreshold = threshold.min_temperature
        maxThreshold = threshold.max_temperature
      }

      let abnormalType: "below" | "above" | null = null
      let gracePeriodHours: number

      if (currentTemp < minThreshold) {
        abnormalType = "below"
        gracePeriodHours = 1
      } else if (currentTemp > maxThreshold) {
        abnormalType = "above"
        gracePeriodHours = 8
      }

      if (!abnormalType) {
        await NotificationCache.del(rtmdId)
        return
      }

      const shouldSendNotification = await this.shouldSendNotification(
        c,
        rtmdId,
        abnormalType,
        actualTime,
        gracePeriodHours
      )

      if (shouldSendNotification) {
        await this.sendTemperatureAbnormalNotification(
          c,
          context,
          rtmdId,
          assetInventoryId,
          assetInfo.asset_name || `Asset ${assetInventoryId}`,
          assetInfo.entity_name || `Entity`,
          currentTemp,
          minThreshold,
          maxThreshold,
          abnormalType,
          actualTime,
          assetInfo.entity_id,
          assetInfo
        )
      } else {
        console.log(
          `Notification delayed for RTMD ${rtmdId} - within grace period`
        )
      }
    } catch (error) {
      console.error("Error in checkAndSendTemperatureNotification:", error)
    }
  }

  private async shouldSendNotification(
    c: Context<DB>,
    rtmdId: number,
    abnormalType: "below" | "above",
    actualTime: Date,
    gracePeriodHours: number
  ): Promise<boolean> {
    try {
      const cachedRecord = await NotificationCache.get(rtmdId)

      if (!cachedRecord) {
        await NotificationCache.set(rtmdId, {
          rtmd_id: rtmdId,
          last_notification_abnormal_type: abnormalType,
          last_notification_time: new Date(actualTime),
        })
        return false
      }

      if (cachedRecord.last_notification_abnormal_type !== abnormalType) {
        await NotificationCache.set(rtmdId, {
          rtmd_id: rtmdId,
          last_notification_abnormal_type: abnormalType,
          last_notification_time: new Date(actualTime),
        })
        return false
      }

      const graceStartTime = moment(cachedRecord.last_notification_time)
      const now = moment(actualTime)
      const minutesSinceGraceStart = now.diff(graceStartTime, "minutes")
      const gracePeriodMinutes = gracePeriodHours * 60

      if (minutesSinceGraceStart >= gracePeriodMinutes) {
        await NotificationCache.set(rtmdId, {
          rtmd_id: rtmdId,
          last_notification_abnormal_type: abnormalType,
          last_notification_time: new Date(actualTime),
        })
        return true
      }

      return false
    } catch (error) {
      console.error("Error checking if should send notification:", error)
      return true // Fail-safe to ensure notifications aren't missed due to errors
    }
  }

  private async findFirstAbnormalOccurrence(
    c: Context<DB>,
    rtmdId: number,
    abnormalType: "below" | "above",
    currentTime: Date
  ): Promise<any> {
    try {
      const thresholdData = await this.getCurrentThresholdForRtmd(c, rtmdId)
      if (!thresholdData) {
        return null
      }

      const { min_temperature: minThreshold, max_temperature: maxThreshold } =
        thresholdData

      const query = c.var.trx
        .selectFrom("asset_rtmd_histories")
        .select(["actual_time", "temperature"])
        .where("asset_rtmd_id", "=", rtmdId)
        .where("actual_time", "<=", currentTime)
        .where("temperature", "is not", null)
        .orderBy("actual_time", "desc")
        .limit(100)

      const records = await query.execute()
      let firstAbnormalRecord: any = null
      const sevenDaysAgo = moment().subtract(7, "days")

      for (const record of records) {
        if (record.temperature === null) continue
        const recordTime = moment(record.actual_time)
        if (recordTime.isBefore(sevenDaysAgo)) {
          continue
        }

        if (abnormalType === "below" && record.temperature < minThreshold) {
          firstAbnormalRecord = {
            ...record,
            min_threshold: minThreshold,
            max_threshold: maxThreshold,
          }
          break
        } else if (
          abnormalType === "above" &&
          record.temperature > maxThreshold
        ) {
          firstAbnormalRecord = {
            ...record,
            min_threshold: minThreshold,
            max_threshold: maxThreshold,
          }
          break
        }
      }

      return firstAbnormalRecord
    } catch (error) {
      console.error("Error finding first abnormal occurrence:", error)
      return null
    }
  }

  private async getCurrentThresholdForRtmd(
    c: Context<DB>,
    rtmdId: number
  ): Promise<any> {
    try {
      // Get asset info with other capacity data
      const assetData =
        await this.assetMonitoringTemperatureRepo.getAssetInfoByRtmdId(
          c,
          rtmdId
        )

      if (!assetData) {
        return null
      }

      if (assetData.other_min_temperature && assetData.other_max_temperature) {
        return {
          id: assetData.other_capacity_id,
          min_temperature: assetData.other_min_temperature,
          max_temperature: assetData.other_max_temperature,
        }
      }
      const capacityQuery = await c.var.trx
        .selectFrom("asset_models_temperatures_capacities")
        .select("asset_type_temperature_id")
        .where("asset_model_id", "=", assetData.asset_model_id)
        .where("id", "=", assetData.asset_model_temperature_capacity_id)
        .where("deleted_at", "is", null)
        .executeTakeFirst()

      if (!capacityQuery) {
        return null
      }

      if (
        !capacityQuery.asset_type_temperature_id ||
        capacityQuery.asset_type_temperature_id === 0
      ) {
        return null
      }

      // Get standard temperature capacity thresholds
      const thresholdData =
        await this.assetMonitoringTemperatureRepo.getTemperatureThresholdsByAssetModelId(
          c,
          capacityQuery.asset_type_temperature_id,
          null,
          null,
          assetData.asset_model_id,
          capacityQuery.asset_type_temperature_id,
          assetData.asset_model_temperature_capacity_id
        )

      if (!thresholdData || thresholdData.length === 0) {
        return null
      }

      const threshold = thresholdData[0]

      return threshold
    } catch (error) {
      console.error("Error getting current threshold for RTMD:", error)
      return null
    }
  }

  private async hasNormalTemperatureBetween(
    c: Context<DB>,
    rtmdId: number,
    startTime: Date,
    endTime: Date,
    minThreshold: number,
    maxThreshold: number
  ): Promise<boolean> {
    try {
      const normalRecords = await c.var.trx
        .selectFrom("asset_rtmd_histories")
        .select("temperature")
        .where("asset_rtmd_id", "=", rtmdId)
        .where("actual_time", ">", startTime)
        .where("actual_time", "<", endTime)
        .where("temperature", ">=", minThreshold)
        .where("temperature", "<=", maxThreshold)
        .limit(1)
        .execute()

      return normalRecords.length > 0
    } catch (error) {
      console.error("Error checking for normal temperature between:", error)
      return false
    }
  }

  private async sendTemperatureAbnormalNotification(
    c: Context<DB>,
    context: HonoContext,
    rtmdId: number,
    assetInventoryId: number,
    assetName: string,
    entityName: string,
    currentTemp: number,
    minThreshold: number,
    maxThreshold: number,
    abnormalType: "below" | "above",
    firstAbnormalTime: Date,
    entityId: number,
    assetInfo: any
  ): Promise<void> {
    try {
      // Use existing notification types for now (can be extended later)
      const notificationType =
        abnormalType === "below"
          ? NOTIFICATION_TYPE.BELOW_EXCURSION
          : NOTIFICATION_TYPE.ABOVE_EXCURSION

      const notifChannel =
        await this.notificationTypeRepo.generateNotificationChannels(
          c,
          notificationType
        )

      const message = this.TemplateMessageToSend
      message.type = notificationType
      message.event_code = await this.getEventCode()

      if (abnormalType === "below") {
        message.title =
          "notification.title.temperature_excursion_below_min_threshold"
        message.message = "notification.message.temperature_below_threshold"
        message.template = "temperature_below_threshold"
        message.variables = [
          assetName,
          entityName,
          currentTemp.toString(),
          minThreshold.toString(),
          maxThreshold.toString(),
          moment(firstAbnormalTime)
            .tz("Asia/Jakarta")
            .format("DD/MM/YYYY HH.mm"),
        ]
      } else {
        message.title =
          "notification.title.temperature_excursion_above_max_threshold"
        message.message = "notification.message.temperature_above_threshold"
        message.template = "temperature_above_threshold"
        message.variables = [
          assetName,
          entityName,
          currentTemp.toString(),
          minThreshold.toString(),
          maxThreshold.toString(),
          moment(firstAbnormalTime)
            .tz("Asia/Jakarta")
            .format("DD/MM/YYYY HH.mm"),
        ]
      }

      const dataMessage = {
        // asset_name: assetName,
        // entity_name: entityName,
        serial_number: assetInfo.serial_number || "",
        asset_model_name: assetInfo.asset_model_name || "",
        manufacturer_name: assetInfo.manufacture_name || "",
        current_temperature: currentTemp.toString(),
        actual_time: moment(firstAbnormalTime)
          .tz("Asia/Jakarta")
          .format("DD/MM/YYYY HH.mm"),
        // customer_entity: entityName,
        // min_threshold: minThreshold.toString(),
        // max_threshold: maxThreshold.toString(),
        // first_abnormal_time: moment(firstAbnormalTime).tz("Asia/Jakarta").format("DD/MM/YYYY HH:mm:ss"),
      }

      await this.sendNotifToUser(
        c,
        context,
        entityId,
        message,
        dataMessage,
        notifChannel
      )
    } catch (error) {
      console.error("Error sending temperature abnormal notification:", error)
    }
  }

  private readonly sendNotifToUser = async (
    c: Context<DB>,
    context: HonoContext,
    entityId: number,
    message: any,
    dataMessage: any,
    notifChannel: { media: string; worker: string }[]
  ): Promise<void> => {
    try {
      const [userEntities, userVendors] = await Promise.all([
        this.userRepo.getUserByEntityId(c, entityId),
        this.userRepo.getUserVendorByCustomerId(c, entityId),
      ])

      for (const user of [...userEntities, ...userVendors]) {
        // Add customer_entity for vendor users
        const enhancedDataMessage = {
          ...dataMessage,
          customer_entity: user.entity_name,
        }

        const payload = await this.buildMessageForUser(
          user,
          message,
          enhancedDataMessage
        )
        for (const channel of notifChannel) {
          if (
            (channel.media === NOTIFICATION_MEDIA.WHATSAPP &&
              !user.mobile_phone) ||
            (channel.media === NOTIFICATION_MEDIA.FIREBASE &&
              !user.fcm_token) ||
            (channel.media === NOTIFICATION_MEDIA.EMAIL && !user.email)
          ) {
            continue
          } else {
            payload.media = channel.media
            payload.worker = channel.worker
            payload.workerMedia = channel.media
            payload.messageTranslation = this.setMessage(
              context.var.t,
              payload.message
            )
            payload.titleTranslation = this.setMessage(
              context.var.t,
              payload.title
            )
            await this.publisher.publishNotification(
              context,
              payload.worker,
              payload
            )
          }
        }
      }
    } catch (error) {
      console.error("Error sending notification to users:", error)
    }
  }

  private async buildMessageForUser(
    user: any,
    message: any,
    dataMessage: any
  ): Promise<any> {
    return {
      ...message,
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
      message: `${message.message}, ${JSON.stringify(dataMessage)}`,
      user_entity_tag_id: user.entity_tag_id || null,
    }
  }

  public setMessage(t: any, data: string) {
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

  async clearNotificationCache(rtmdId?: number): Promise<void> {
    if (rtmdId) {
      await NotificationCache.del(rtmdId)
    } else {
      await NotificationCache.clearAll()
    }
  }

  async getNotificationCacheStatus(): Promise<
    Array<{
      rtmd_id: number
      abnormal_type: string
      last_notified: string
    }>
  > {
    const cacheRecords = await NotificationCache.getNotificationCacheStatus()
    return cacheRecords.map((record) => ({
      rtmd_id: record.rtmd_id,
      abnormal_type: record.last_notification_abnormal_type || "unknown",
      last_notified: record.last_notification_time?.toISOString() || "never",
    }))
  }
}
