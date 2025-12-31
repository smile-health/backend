import { Context } from "hono"
import moment from "moment"
import { BaseRepository } from "../base.repository.js"
import { datamart } from "@/common/infrastructure/database/datamart.js"
import { slave } from "@/common/infrastructure/database/slave.js"
import { WsEntities } from "@/common/infrastructure/database/types/db.js"
import { sql, Selectable } from "kysely"
import { USER_ROLE } from "@/common/constants/user.js"

export class AppMobileNotifRepository extends BaseRepository<"ws_stocks"> {
  constructor() {
    super("ws_stocks", false, true)
  }

  async getNotifMaterialHierarchy(
    c: Context,
    entityId: number,
    programId: number
  ) {
    const now = new Date()
    const thirtyDaysFromNow = moment().add(30, "days").toDate()

    const result = await c.var.trx
      .selectFrom("ws_stocks as s")
      .innerJoin("ws_batches as b", "b.id", "s.batch_id")
      .innerJoin("ws_materials as m", "m.id", "s.material_id")
      .innerJoin("ws_materials as pm", "pm.id", "m.parent_id")
      .innerJoin("ws_activities as a", "a.id", "s.activity_id")
      .innerJoin("ws_entities as e", "e.id", "s.entity_id")
      .where("s.entity_id", "=", entityId)
      .where("a.program_id", "=", programId)
      .where("s.qty", ">", 0)
      .where("m.deleted_at", "is", null)
      .where("pm.deleted_at", "is", null)
      .where("a.deleted_at", "is", null)
      .where("e.deleted_at", "is", null)
      .select([
        "e.id as entity_id",
        "e.name as entity_name",
        "a.id as activity_id",
        "a.name as activity_name",
        "pm.id as parent_material_id",
        "pm.name as parent_material_name",
        "m.id as material_id",
        "m.name as material_name",
        "b.expired_date",
        sql<number>`
          CASE 
            WHEN b.expired_date <= ${now} THEN 1
            ELSE 0
          END
        `.as("expired_qty"),
        sql<number>`
          CASE 
            WHEN b.expired_date > ${now} AND b.expired_date <= ${thirtyDaysFromNow} THEN 1
            ELSE 0
          END
        `.as("expired_in_30_day_qty"),
      ])
      .execute()

    return result
  }

  async getNotifMaterialNonHierarchy(
    c: Context,
    entityId: number,
    programId: number
  ) {
    const now = new Date()
    const thirtyDaysFromNow = moment().add(30, "days").toDate()

    const result = await c.var.trx
      .selectFrom("ws_stocks as s")
      .innerJoin("ws_batches as b", "b.id", "s.batch_id")
      .innerJoin("ws_materials as m", "m.id", "s.material_id")
      .innerJoin("ws_activities as a", "a.id", "s.activity_id")
      .innerJoin("ws_entities as e", "e.id", "s.entity_id")
      .where("s.entity_id", "=", entityId)
      .where("a.program_id", "=", programId)
      .where("s.qty", ">", 0)
      .where("m.deleted_at", "is", null)
      .where("a.deleted_at", "is", null)
      .where("e.deleted_at", "is", null)
      .select([
        "e.id as entity_id",
        "e.name as entity_name",
        "a.id as activity_id",
        "a.name as activity_name",
        "m.id as material_id",
        "m.name as material_name",
        "b.expired_date",
        sql<number>`
          CASE 
            WHEN b.expired_date <= ${now} THEN 1
            ELSE 0
          END
        `.as("expired_qty"),
        sql<number>`
          CASE 
            WHEN b.expired_date > ${now} AND b.expired_date <= ${thirtyDaysFromNow} THEN 1
            ELSE 0
          END
        `.as("expired_in_30_day_qty"),
      ])
      .execute()

    return result
  }

  async getTotalShippedByVendor(
    c: Context,
    programId: number,
    statusId: number,
    entityId: number
  ) {
    let query = slave.selectFrom("ws_order_lists")

    if (datamart) {
      query = datamart.selectFrom(sql`datamart_order_list_v5 FINAL`)
    }

    query = query.where("status_id", "=", statusId)

    query = query.where("vendor_id", "=", entityId)

    const result = await query
      .where("program_id", "=", programId)
      .select(sql`COUNT(*) OVER ()`.as("total_vendor"))
      .executeTakeFirst()

    return result
  }

  async getTotalShippedByCustomer(
    c: Context,
    programId: number,
    statusId: number,
    entityId: number
  ) {
    let query = slave.selectFrom("ws_order_lists")

    if (datamart) {
      query = datamart.selectFrom(sql`datamart_order_list_v5 FINAL`)
    }

    query = query.where("status_id", "=", statusId)

    query = query.where("customer_id", "=", entityId)

    const result = await query
      .where("program_id", "=", programId)
      .select(sql`COUNT(*) OVER ()`.as("total_customer"))
      .executeTakeFirst()

    return result
  }
}
