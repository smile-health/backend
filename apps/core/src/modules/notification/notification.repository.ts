import { notificationDb as db } from "@/common/infrastructure/database/index.js"
import {
  GetNotificationsQueryParams,
  GetNotificationsTypesPagination,
} from "@/modules/notification/notification.schema"
import { Context } from "hono"
import { sql } from "kysely"

export class NotificationRepository {
  async getListNotification(
    c: Context,
    params: GetNotificationsQueryParams,
    entityIdList: number[]
  ) {
    const {
      page,
      paginate,
      province_id,
      city_id,
      health_center_id,
      receive_date,
      notification_type,
      entity_tag_ids,
      program_ids,
      limit,
    } = params
    const offset = (page - 1) * paginate

    let entityIds: number[] = entityIdList

    if (entity_tag_ids) {
      const queryEntities = await c.var.trx
        .selectFrom("ws_entities")
        .select(["id"])
        .where("entity_tag_id", "in", entity_tag_ids)
        .$if(entityIds.length > 0, (b) => b.where("id", "in", entityIds))
        .execute()

      if (queryEntities && queryEntities.length > 0) {
        entityIds = queryEntities.map((item) => item.id)
      } else {
        entityIds = [0]
      }
    }

    let queries = db.selectFrom("notifications as n").where("media", "=", "fcm")

    if (entityIds.length > 0) {
      queries = queries.where("entity_id", "in", entityIds)
    }

    if (province_id) {
      queries = queries.where("province_id", "=", province_id)
    }

    if (city_id) {
      queries = queries.where("regency_id", "=", city_id)
    }

    if (health_center_id) {
      queries = queries.where("entity_id", "=", health_center_id)
    }

    if (notification_type) {
      queries = queries.where("type", "=", notification_type)
    }

    if (receive_date) {
      const startDate = new Date(receive_date)
      const endDate = new Date(receive_date)
      endDate.setDate(endDate.getDate() + 1)

      queries = queries
        .where("created_at", ">=", sql.lit(startDate))
        .where("created_at", "<", sql.lit(endDate))
    }

    if (program_ids) {
      queries = queries.where("program_id", "in", program_ids)
    }

    let list: any[] = []
    let total: number = 0

    if (limit) {
      list = await queries
        .selectAll()
        .orderBy("id", "desc")
        .limit(limit)
        .offset(offset)
        .execute()

      total = list.length
    } else {
      const [fetchedList, totalResult] = await Promise.all([
        queries
          .selectAll()
          .orderBy("id", "desc")
          .limit(paginate)
          .offset(offset)
          .execute(),
        queries.select((eb) => eb.fn.countAll().as("total")).executeTakeFirst(),
      ])

      list = fetchedList
      total = Number(totalResult?.total) || 0
    }

    return {
      list,
      total,
    }
  }

  async updateNotification(id: number, data) {
    await db
      .updateTable("notifications")
      .set(data)
      .where("id", "=", id)
      .executeTakeFirst()
  }

  async getLocationById(c: Context, id: number, level: number) {
    return await c.var.trx
      .selectFrom("locations")
      .selectAll()
      .where("id", "=", id)
      .where("level", "=", level)
      .executeTakeFirst()
  }

  async getEntityTagByIds(c: Context, ids: number[]) {
    return await c.var.trx
      .selectFrom("entity_tags")
      .selectAll()
      .where("id", "in", ids)
      .where("deleted_at", "is", null)
      .execute()
  }

  async getProgramByIds(c: Context, ids: number[]) {
    return await c.var.trx
      .selectFrom("workspaces")
      .selectAll()
      .where("id", "in", ids)
      .where("deleted_at", "is", null)
      .execute()
  }

  async getEntityById(c: Context, id: number) {
    return await c.var.trx
      .selectFrom("ws_entities")
      .selectAll()
      .where("id", "=", id)
      .where("deleted_at", "is", null)
      .execute()
  }

  async getUserByIds(c: Context, ids: number[]) {
    if (ids.length === 0) return []

    return await c.var.trx
      .selectFrom("ws_users")
      .select(["id", "username", "firstname", "lastname", "role", "entity_id"])
      .where("id", "in", ids)
      .execute()
  }

  async getEntityByIds(c: Context, ids: number[]) {
    if (ids.length === 0) return []

    return await c.var.trx
      .selectFrom("ws_entities")
      .select([
        "id",
        "name",
        "province_id",
        "regency_id",
        "sub_district_id",
        "type",
        "is_puskesmas",
        "entity_tag_id",
      ])
      .where("id", "in", ids)
      .execute()
  }

  async getLocationByIds(c: Context, ids: number[]) {
    if (ids.length === 0) return []

    return await c.var.trx
      .selectFrom("locations")
      .select(["id", "name"])
      .where("id", "in", ids)
      .execute()
  }

  async getNotificationById(id: number) {
    return await db
      .selectFrom("notifications")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst()
  }

  async updateNotificationsMarkedAllRead(ids: number[], data) {
    await db
      .updateTable("notifications")
      .set(data)
      .where("id", "in", ids)
      .execute()
  }

  private translateNotifType(c: Context, input: string) {
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

  async getListNotificationType(
    c: Context,
    params: GetNotificationsTypesPagination
  ) {
    const { page, paginate, keyword } = params
    const offset = (page - 1) * paginate
    const query = await c.var.trx
      .selectFrom("notification_types")
      .select(["id", "title", "type"])
      .where("deleted_at", "is", null)
      .execute()

    let result = query.map(({ title, ...item }) => ({
      ...item,
      title: this.translateNotifType(c, String(title)),
    }))

    if (keyword)
      result = result.filter((item) =>
        new RegExp(keyword, "i").test(item.title!)
      )

    return {
      list: result.slice(offset, offset + paginate),
      total: result.length,
    }
  }

  async getEntityByProvince(c: Context, provinceIds: string[]) {
    return await c.var.trx
      .selectFrom("ws_entities")
      .select(["id"])
      .where((eb) =>
        eb.or([
          eb.and([
            eb("province_id", "in", provinceIds),
            eb("regency_id", "is", null),
            eb("sub_district_id", "is", null),
            eb("village_id", "is", null),
            eb("type", "=", 1),
            eb("is_puskesmas", "=", 0),
          ]),
          eb.and([
            eb("province_id", "in", provinceIds),
            eb("sub_district_id", "is", null),
            eb("village_id", "is", null),
            eb("type", "=", 2),
            eb("is_puskesmas", "=", 0),
          ]),
          eb.and([
            eb("province_id", "in", provinceIds),
            eb("village_id", "is", null),
            eb("type", "=", 3),
            eb("is_puskesmas", "=", 1),
          ]),
        ])
      )
      .where("deleted_at", "is", null)
      .execute()
  }

  async getEntityByRegency(c: Context, regencyIds: string[]) {
    return await c.var.trx
      .selectFrom("ws_entities")
      .select(["id"])
      .where((eb) =>
        eb.or([
          eb.and([
            eb("regency_id", "in", regencyIds),
            eb.or([
              eb("sub_district_id", "is", null),
              eb("sub_district_id", "=", ""),
            ]),
            eb.or([eb("village_id", "is", null), eb("village_id", "=", "")]),
            eb("type", "=", 2),
            eb("is_puskesmas", "=", 0),
          ]),
          eb.and([
            eb("regency_id", "in", regencyIds),
            eb.or([eb("village_id", "is", null), eb("village_id", "=", "")]),
            eb("type", "=", 3),
            eb("is_puskesmas", "=", 1),
          ]),
        ])
      )
      .where("deleted_at", "is", null)
      .execute()
  }

  async getWorkspaceByIds(c: Context, ids: number[]) {
    if (ids.length === 0) return []

    return await c.var.trx
      .selectFrom("workspaces")
      .select(["id", "key", "name", "config"])
      .where("id", "in", ids)
      .execute()
  }

  async getListNotificationForCount(c: Context, entityIdList: number[]) {
    const weekAgo = new Date()
    weekAgo.setHours(0, 0, 0, 0) // set ke jam 00:00 hari ini
    weekAgo.setDate(weekAgo.getDate() - 7) // mundur 7 hari
    console.log({ weekAgo })
    let query = db
      .selectFrom("notifications as n")
      .select((eb) => [
        eb.fn.count<number>("n.id").as("all"),
        eb.fn
          .sum<number>(
            eb.case().when("n.read_at", "is", null).then(1).else(0).end()
          )
          .as("unread"),
        eb.fn
          .sum<number>(
            eb.case().when("n.read_at", "is not", null).then(1).else(0).end()
          )
          .as("read"),
      ])
      .where("media", "=", "fcm")
      .where("created_at", ">=", (eb) => eb.val(weekAgo))

    if (entityIdList.length > 0) {
      query = query.where("entity_id", "in", entityIdList)
    }

    const result = await query.executeTakeFirst()

    return {
      all: result?.all ?? 0,
      unread: result?.unread ?? 0,
      read: result?.read ?? 0,
    }
  }

  async getListNotificationUnread(c: Context, entityIdList: number[]) {
    let queries = db
      .selectFrom("notifications as n")
      .where("media", "=", "fcm")
      .where("user_id", "=", c.var.accountID)

    if (entityIdList.length > 0) {
      queries = queries.where("entity_id", "in", entityIdList)
    }

    queries = queries.where("read_at", "is", null)

    const list = await queries.selectAll().orderBy("id", "desc").execute()

    return list
  }
}
