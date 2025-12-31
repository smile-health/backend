import { db } from "@/common/infrastructure/database/index.js"
import { DB } from "@/common/infrastructure/database/types/db.js"
import { Context } from "@smile/lib/types/context.js"
import { Context as CtxHono } from "hono"
import { CompiledQuery, sql } from "kysely"
import { ListCustomerVendorActivityDTO } from "../app-mobile-data/app-mobile-data.schema.js"
import {
  GetEntityActivitiesAdditionalQueries,
  InsertEntityActivityDateDTO,
  SubmitEntityActivitiesRequest,
  UpdateEntityActivityDateDTO,
} from "./entity-activity.schema.js"

export class EntityActivityRepository {
  async getListEntityActivity(
    c: Context<DB>,
    id: number,
    params: GetEntityActivitiesAdditionalQueries,
    programId: number
  ) {
    const { keyword, is_ongoing, is_ordered_sales, is_ordered_purchase } =
      params
    let query = c.var.trx
      .selectFrom("ws_activities as ma")
      .innerJoin("ws_entity_activities as ead", (join) =>
        join
          .onRef("ead.activity_id", "=", "ma.id")
          .on("ead.deleted_at", "is", null)
      )
      .innerJoin("ws_entities as e", (join) =>
        join
          .onRef("ead.entity_id", "=", "e.id")
          .on("ead.deleted_at", "is", null)
      )
      .where("ead.entity_id", "=", id)
      .where("ma.deleted_at", "is", null)
      .where("ma.program_id", "=", programId)
      .where("ma.status", "=", 1)
      .where("e.deleted_at", "is", null)
      .where("e.program_id", "=", programId)

    if (keyword) {
      query = query.where("ma.name", "like", `%${keyword}%`)
    }

    if (is_ongoing && is_ongoing === 1) {
      const today = new Date().toISOString().split("T")[0]
      query = query
        .where((eb) =>
          eb.or([
            eb("ead.end_date", ">=", sql<Date>`${today}`),
            eb("ead.end_date", "is", null),
          ])
        )
        .where("ead.start_date", "<=", sql<Date>`${today}`)
    }

    if ([0, 1].includes(is_ordered_sales!)) {
      query = query.where("ma.is_ordered_sales", "=", is_ordered_sales!)
    }

    if ([0, 1].includes(is_ordered_purchase!)) {
      query = query.where("ma.is_ordered_purchase", "=", is_ordered_purchase!)
    }

    return query
      .select([
        "ma.id",
        "ma.name",
        "ead.id as entity_activity_id",
        "ead.start_date",
        "ead.end_date",
        "ma.is_ordered_purchase",
        "ma.is_ordered_sales",
      ])
      .orderBy("ead.start_date")
      .execute()
  }

  async getListActivity(c: Context<DB>, programId: number, ids?: number[]) {
    let query = c.var.trx
      .selectFrom("ws_activities")
      .where("deleted_at", "is", null)
      .where("program_id", "=", programId)

    if (ids) {
      query = query.where("id", "in", ids)
    }
    return query.select(["id", "name"]).execute()
  }

  async getListEntityActivityDate(
    c: Context<DB>,
    params: SubmitEntityActivitiesRequest,
    programId: number
  ) {
    const { entity_id } = params
    return c.var.trx
      .selectFrom("ws_entity_activities as ead")
      .leftJoin("ws_activities as ma", "ma.id", "ead.activity_id")
      .leftJoin("ws_entities as e", "e.id", "ead.entity_id")
      .where("ead.entity_id", "=", entity_id)
      .where("ead.deleted_at", "is", null)
      .where("ma.program_id", "=", programId)
      .where("e.program_id", "=", programId)
      .where("ma.deleted_at", "is", null)
      .where("e.deleted_at", "is", null)
      .select([
        "ead.entity_id",
        "ead.activity_id",
        "ead.id",
        "ead.start_date",
        "ead.end_date",
        "ma.name",
      ])
      .execute()
  }

  async insertActivities(c: Context<DB>, data: InsertEntityActivityDateDTO[]) {
    return c.var.trx.insertInto("ws_entity_activities").values(data).execute()
  }

  async updateActivities(c: Context<DB>, data: UpdateEntityActivityDateDTO[]) {
    for (const item of data) {
      await c.var.trx
        .updateTable("ws_entity_activities")
        .set({
          start_date: item.start_date,
          end_date: item.end_date,
          updated_at: new Date(),
        })
        .where("activity_id", "=", item.activity_id)
        .where("id", "=", item.id)
        .where("deleted_at", "is", null)
        .execute()
    }
  }

  async getActivitiesStartEnd(c: CtxHono) {
    const { rows } = await db.executeQuery(
      CompiledQuery.raw("select get_activities_start_end(?, ?) as result", [
        c.var.programId,
        c.var.entityId,
      ])
    )

    return rows[0] as {
      result: Pick<ListCustomerVendorActivityDTO, "activities">
    }
  }

  async getActivityByEntityIdAndActivityId(
    c: Context<DB>,
    entityId: number,
    activityId: number
  ) {
    return c.var.trx
      .selectFrom("ws_entity_activities")
      .where("entity_id", "=", entityId)
      .where("activity_id", "=", activityId)
      .where("deleted_at", "is", null)
      .select(["id"])
      .executeTakeFirst()
  }
}
