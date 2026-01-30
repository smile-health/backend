import { USER_ROLE } from "@/common/constants/users.js"
import tracedRedis from "@/common/infrastructure/redis.js"
import { PaginatedResponse } from "@smile-health/lib/types/paginate.js"
import { Context } from "hono"
import { NotificationRepository } from "./notification.repository.js"
import {
  GetNotificationsQueryParams,
  GetNotificationsTypesPagination,
} from "./notification.schema.js"

export class NotificationModule {
  private readonly CACHE_TTL = 120 // seconds

  constructor(private readonly repository: NotificationRepository) {}

  private parseNotificationData(input: unknown) {
    if (input === null || input === undefined) return null
    if (typeof input !== "string") return input

    try {
      const parsedOnce = JSON.parse(input)

      if (typeof parsedOnce !== "string") return parsedOnce

      try {
        return JSON.parse(parsedOnce)
      } catch {
        return parsedOnce
      }
    } catch {
      return input
    }
  }

  async list(c: Context, params: GetNotificationsQueryParams) {
    const entityIdList = await this.getEntityByRole(c)

    const { list, total } = await this.repository.getListNotification(
      c,
      params,
      entityIdList
    )

    if (list.length === 0) return new PaginatedResponse(params, list, total)

    const userIds = list.map((item) => item.user_id)
    const entityIds = list.map((item) => item.entity_id)
    const provinceIds = list.map((item) => item.province_id)
    const regencyIds = list.map((item) => item.regency_id)
    const workspaceIds = list.map((item) => item.program_id)

    const [users, entities, provinces, regencies, workspaces] =
      await Promise.all([
        this.repository.getUserByIds(c, userIds),
        this.repository.getEntityByIds(c, entityIds),
        this.repository.getLocationByIds(c, provinceIds),
        this.repository.getLocationByIds(c, regencyIds),
        this.repository.getWorkspaceByIds(c, workspaceIds),
      ])

    const userMap = this.setObject(users)
    const entityMap = this.setObject(entities)
    const provinceMap = this.setObject(provinces)
    const regencyMap = this.setObject(regencies)
    const workspaceMap = this.setObject(workspaces)

    const result = list.map(
      ({
        user_id,
        entity_id,
        province_id,
        regency_id,
        data,
        message,
        type,
        title,
        program_id,
        ...item
      }) => ({
        ...item,
        data: this.parseNotificationData(data),
        message: this.setMessage(c, message),
        type: this.setType(c, type, title),
        user: userMap[user_id],
        entity: entityMap[entity_id],
        province: provinceMap[province_id],
        regency: regencyMap[regency_id],
        program: workspaceMap[program_id],
      })
    )

    return new PaginatedResponse(params, result, total)
  }

  async updateSingleRead(id: number) {
    await this.repository.updateNotification(id, { read_at: new Date() })
    return
  }

  async updateAllRead(c: Context) {
    const entityIdList = await this.getEntityByRole(c)

    const list = await this.repository.getListNotificationUnread(
      c,
      entityIdList
    )

    if (list.length > 0) {
      const ids = list.map((item) => item.id)
      await this.repository.updateNotificationsMarkedAllRead(ids, {
        read_at: new Date(),
      })
    }

    return
  }

  async count(c: Context) {
    const entityIdList = await this.getEntityByRole(c)

    const cacheKey = this.generateCacheKey(c, entityIdList)

    // Try to get from cache first
    try {
      const cachedResult = await tracedRedis.get(cacheKey)
      if (cachedResult) {
        return JSON.parse(cachedResult)
      }
    } catch (error) {
      console.warn("Redis cache read failed:", error)
    }

    // If not in cache, fetch from database
    const result = await this.repository.getListNotificationForCount(
      c,
      entityIdList
    )

    // Store in cache with 5 minute TTL
    try {
      const cacheKey = this.generateCacheKey(c, entityIdList)
      await tracedRedis.set(cacheKey, JSON.stringify(result), this.CACHE_TTL)
    } catch (error) {
      console.warn("Redis cache write failed:", error)
    }

    return result
  }

  async typeList(c: Context, params: GetNotificationsTypesPagination) {
    const { list, total } = await this.repository.getListNotificationType(
      c,
      params
    )

    return new PaginatedResponse(params, list, total)
  }

  private setObject(data) {
    const dataMap = Object.fromEntries(data.map((data) => [data.id, data]))
    return dataMap
  }

  private setMessage(c: Context, data: string) {
    const splitIndex = data.indexOf(", {")
    const { language } = c.var
    if (splitIndex === -1) return c.var.t(data) || data

    const label = data.slice(0, splitIndex).trim()
    const jsonString = data.slice(splitIndex + 2).trim()

    try {
      const json = JSON.parse(jsonString)
      const t = c.var.t

      const transformed = Object.fromEntries(
        Object.entries(json).map(([k, v]) => {
          if (!isNaN(Number(v))) {
            v = new Intl.NumberFormat(
              `${language === "id" ? "id-ID" : "en-EN"}`
            ).format(Number(v))
          }
          return [k, typeof v === "string" ? t(v) : v]
        })
      )

      return t(label, transformed)
    } catch (e) {
      return data
    }
  }

  private setType(c: Context, type: string, title: string) {
    const result = {
      type: type,
      title: this.setMessage(c, title),
    }
    return result
  }

  private translateSmart(c: Context, input: string) {
    const prefix = "notification.type."

    if (input.startsWith(prefix)) {
      return c.var.t(input)
    }

    const translated = c.var.t(prefix + input)

    if (translated !== prefix + input) {
      return translated
    }

    return input
  }

  private async getEntityByRole(c: Context) {
    const { role, mapWsUserId } = c.var

    const userIds = Object.values(mapWsUserId)

    const users = await this.repository.getUserByIds(c, userIds)

    const entityIds = users.map((item) => item.entity_id)

    const entities = await this.repository.getEntityByIds(c, entityIds)

    const entityType = entities[0]?.type

    const provinceIds = [
      ...new Set(entities.map((item) => String(item.province_id))),
    ]

    const regencyIds = [
      ...new Set(entities.map((item) => String(item.regency_id))),
    ]

    const subDistrictIds = [
      ...new Set(entities.map((item) => String(item.sub_district_id))),
    ]

    let entityId: number[] | [] = []

    if (
      role === USER_ROLE.MANAGER &&
      entityType === 1 &&
      provinceIds &&
      provinceIds.length > 0
    ) {
      const entities = await this.repository.getEntityByProvince(c, provinceIds)

      entityId = entities.map((item) => item.id)
    }

    if (
      role === USER_ROLE.MANAGER &&
      entityType === 2 &&
      regencyIds &&
      regencyIds.length > 0
    ) {
      const entities = await this.repository.getEntityByRegency(c, regencyIds)

      entityId = entities.map((item) => item.id)
    }

    if (
      role === USER_ROLE.OPERATOR &&
      entityType === 3 &&
      subDistrictIds &&
      subDistrictIds.length > 0
    ) {
      entityId = entityIds
    }

    return entityId
  }

  private generateCacheKey(c: Context, entityIdList: number[]): string {
    const userId = c.var.accountID
    const entityIds = entityIdList.sort().join(",")
    return `notification:count:user:${userId}:entities:${entityIds}`
  }
}
