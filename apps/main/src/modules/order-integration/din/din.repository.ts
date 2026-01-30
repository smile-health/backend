/* eslint-disable @typescript-eslint/no-explicit-any */
import { db } from "@/common/infrastructure/database/index.js"
import { IntegrationLogs } from "@/common/infrastructure/database/types/db.js"
import { Context } from "hono"
import { Insertable, sql } from "kysely"
import { OrderIntegrationRepository } from "../order-integration.repository.js"
import { collect } from "@smile-health/lib/utils.js"
import { ORDER_STATUS } from "@/common/constants/order.js"
export class DinRepository extends OrderIntegrationRepository {
  constructor() {
    super()
  }

  async getActivity(c: Context, id: number) {
    return await c.var.trx
      .selectFrom("ws_activities")
      .selectAll()
      .where("id", "=", id)
      .where("deleted_at", "is", null)
      .executeTakeFirst()
  }

  async getActivityIds(c: Context, prgramId: number) {
    const rows = await c.var.trx
      .selectFrom("ws_activities")
      .selectAll()
      .where("program_id", "=", prgramId)
      .where("deleted_at", "is", null)
      .execute()

    return collect(rows, "id")
  }

  async createBudgetSource(c: Context, data: any) {
    const result = await c.var.trx
      .insertInto("budget_sources")
      .values(data)
      .executeTakeFirst()

    return result
  }

  async createBudgetSourceWorkspace(c: Context, data: any) {
    const result = await c.var.trx
      .insertInto("budget_source_workspaces")
      .values(data)
      .executeTakeFirst()

    return result
  }

  async getWsMaterialManufacture(
    c: Context,
    materialId: number,
    programId: number
  ) {
    return await c.var.trx
      .selectFrom("ws_material_manufactures as wmm")
      .innerJoin("ws_manufactures as m", "m.id", "wmm.manufacture_id")
      .where("wmm.material_id", "=", materialId)
      .where("m.program_id", "=", programId)
      .where("wmm.deleted_at", "is", null)
      .select(["wmm.id", "wmm.manufacture_id", "wmm.material_id", "m.name"])
      .executeTakeFirst()
  }

  async getWSMaterialByCodeKfa(c: Context, code: string[]) {
    return await c.var.trx
      .selectFrom("ws_materials")
      .where("code", "in", code)
      .where("deleted_at", "is", null)
      .select([
        "id",
        "global_id",
        "code",
        "parent_id",
        "program_id",
        "parent_global_id",
      ])
      .execute()
  }

  async getWSMaterialByCodeKfaByProgramId(
    c: Context,
    code: string,
    programId: number
  ) {
    return await c.var.trx
      .selectFrom("ws_materials")
      .where("code", "=", code)
      .where("program_id", "=", programId)
      .where("deleted_at", "is", null)
      .select(["id", "global_id", "code", "parent_id", "program_id"])
      .executeTakeFirst()
  }

  async getWSMaterialActivities(
    c: Context,
    materialId: number,
    activityId: number
  ) {
    return await c.var.trx
      .selectFrom("ws_material_activities")
      .where("material_id", "=", materialId)
      .where("activity_id", "=", activityId)
      .where("deleted_at", "is", null)
      .select(["id"])
      .executeTakeFirst()
  }

  async craeteWSMaterialActivities(c: Context, data: any) {
    return c.var.trx.insertInto("ws_material_activities").values(data).execute()
  }

  async createMaterialWorkspace(c: Context, data: any) {
    return c.var.trx.insertInto("material_workspaces").values(data).execute()
  }

  async getWsEntityMaterialActivities(
    c: Context,
    entityId: number,
    materialId: number,
    activityId: number
  ) {
    return await c.var.trx
      .selectFrom("ws_entity_material_activities")
      .where("entity_id", "=", entityId)
      .where("material_id", "=", materialId)
      .where("activity_id", "=", activityId)
      .where("deleted_at", "is", null)
      .select(["id"])
      .executeTakeFirst()
  }

  async createWsEntityMaterialActivities(c: Context, data: any) {
    return c.var.trx
      .insertInto("ws_entity_material_activities")
      .values(data)
      .execute()
  }

  public createLog = async (row: Insertable<IntegrationLogs>) => {
    return await db.insertInto("integration_logs").values(row).execute()
  }

  async getIntegrationLogByJson(c: Context, doc_num: string) {
    return await c.var.trx
      .selectFrom("integration_logs as il")
      .innerJoin("ws_orders as wso", "wso.id", "il.source_id")
      .where("il.tag", "=", "create_order")
      .where("wso.order_status_id", "in", [
        ORDER_STATUS.CANCELED,
        ORDER_STATUS.SHIPPED,
        ORDER_STATUS.FULFILLED,
      ])
      .where((eb) =>
        eb.and([
          sql<boolean>`JSON_VALID(JSON_UNQUOTE(JSON_EXTRACT(${sql.ref("il.request")}, '$.body')))`,
          eb(
            sql<string>`JSON_UNQUOTE(
            JSON_EXTRACT(
              JSON_UNQUOTE(JSON_EXTRACT(${sql.ref("il.request")}, '$.body')),
              '$.doc_num'
            )
          )`,
            "=",
            doc_num
          ),
        ])
      )
      .select([
        sql<string>`JSON_UNQUOTE(JSON_EXTRACT(${sql.ref("il.request")}, '$.body'))`.as(
          "body_content"
        ),
      ])
      .where("il.deleted_at", "is", null)
      .selectAll(["wso"])
      .groupBy("wso.id")
      .execute()
  }
}
