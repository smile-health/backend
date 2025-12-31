import { Context } from "hono"
import {
  GetListActivityQueries,
  GetListProgramQueries,
  GetListStockQueries,
} from "./transfer-stock.schema.js"
import { sql, Kysely } from "kysely"
import { Datamart } from "@/common/infrastructure/database/types/datamart.js"
import { DB } from "@/common/infrastructure/database/types/db.js"
import env from "@/config/env.js"
import { DATASOURCE } from "@/common/constants/common.js"

export class TransferStockRepository {
  async getListProgram(
    c: Context,
    params: GetListProgramQueries,
    entityId: number
  ) {
    const { keyword } = params
    return c.var.trx
      .selectFrom("entity_workspaces as ew")
      .innerJoin("workspaces as w", "w.id", "ew.workspace_id")
      .where("ew.entity_id", "=", entityId)
      .where("w.deleted_at", "is", null)
      .where("w.is_beneficiaries", "=", 0)
      .$if(!!keyword, (eb) => eb.where("w.name", "like", `%${keyword}%`))
      .select(["w.id", "w.key", "w.name", "w.config"])
      .execute()
  }

  async getListActivity(
    c: Context,
    params: GetListActivityQueries,
    materialId: number
  ) {
    const { destination_program_id } = params
    return c.var.trx
      .selectFrom("ws_material_activities as wsma")
      .innerJoin("ws_activities as wsa", "wsa.id", "wsma.activity_id")
      .where("wsma.material_id", "=", materialId)
      .where("wsa.program_id", "=", destination_program_id)
      .where("wsa.deleted_at", "is", null)
      .select(["wsa.id", "wsa.name"])
      .execute()
  }

  async getListStock(
    c: Context,
    programId: number,
    params: GetListStockQueries,
    materialIds: number[]
  ) {
    const { keyword, entity_id } = params

    const source = env.STOCK_LIST_SOURCE
    let useDatamart = false
    let conn: Kysely<DB> | Kysely<Datamart>

    switch (source) {
      case DATASOURCE.DATAMART:
        conn = c.var.datamart
        useDatamart = true
        break
      case DATASOURCE.CLICKHOUSE:
        conn = c.var.slave
        break
      default:
        conn = c.var.trx
        break
    }

    let query = conn
      .selectFrom("ws_stocks as wss")
      .innerJoin("ws_materials as wsm", "wsm.id", "wss.material_id")

    if (useDatamart) {
      query = conn
        .selectFrom(sql`raw_ws_stocks as wss FINAL`)
        .innerJoin(
          sql`raw_ws_materials as wsm FINAL`,
          "wsm.id",
          "wss.material_id"
        )
    }

    const list = await query
      .where("wsm.program_id", "=", programId)
      .where("wsm.material_level_id", "=", 3)
      .where("wss.entity_id", "=", entity_id)
      .where("wss.material_id", "in", materialIds)
      .where("wss.entity_id", "is not", null)
      .where("wsm.deleted_at", "is", null)
      .where("wss.deleted_at", "is", null)
      .$if(!!keyword, (qb) =>
        qb.where((eb) =>
          eb.or([
            eb("wsm.name", "ilike", `%${keyword}%`),
            eb("wsm.code", "ilike", `%${keyword}%`),
            eb("wsm.hierarchy_code", "ilike", `%${keyword}%`),
          ])
        )
      )
      .select([
        "wsm.id as material_id",
        sql`sum(wss.qty)`.as("total_qty"),
        sql`sum(wss.in_transit_qty)`.as("total_in_transit_qty"),
        sql`sum(wss.allocated_qty)`.as("total_allocated_qty"),
        sql`sum(wss.qty - wss.allocated_qty)`.as("total_available_qty"),
        sql`sum(wss.open_vial_qty)`.as("total_open_vial_qty"),
        sql`sum(wss.exterminated_qty)`.as("total_exterminated_qty"),
        sql`sum(wss.unreceived_qty)`.as("total_unreceived_qty"),
        sql`max(wss.updated_at)`.as("updated_at"),
        sql`COUNT(*) OVER ()`.as("total"),
      ])
      .orderBy(sql`lower(wsm.name)`)
      .groupBy(["wsm.id", "wsm.name"])
      .execute()

    return list
  }

  async getListEntityMaterials(
    c: Context,
    params: GetListStockQueries,
    programId: number,
    destinationProgramId: number
  ) {
    const { page, paginate, keyword, entity_id } = params
    const offset = (page - 1) * paginate
    const list = await c.var.trx
      .with("material_workspaces_global", (db) =>
        db
          .selectFrom("material_workspaces as mw")
          .where("mw.workspace_id", "=", destinationProgramId)
          .where("mw.deleted_at", "is", null)
          .where("mw.status", "=", 1)
          .select([
            "mw.material_id as global_material_id",
            "mw.workspace_id as global_material_workspace_id",
          ])
      )
      .selectFrom("ws_entity_material_activities as wsema")
      .innerJoin("ws_materials as wsm", "wsm.parent_id", "wsema.material_id")
      .innerJoin("material_workspaces as mw", "mw.id", "wsm.id")
      .innerJoin("material_workspaces_global as mwg", (join) =>
        join
          .onRef("mwg.global_material_id", "=", "mw.material_id")
          .on("mwg.global_material_workspace_id", "=", destinationProgramId)
      )
      .where("wsm.program_id", "=", programId)
      .where("wsm.material_level_id", "=", 3)
      .where("wsema.entity_id", "=", entity_id)
      .where("wsema.deleted_at", "is", null)
      .where("wsm.deleted_at", "is", null)
      .$if(!!keyword, (qb) =>
        qb.where((eb) =>
          eb.or([
            eb("wsm.name", "like", `%${keyword}%`),
            eb("wsm.code", "like", `%${keyword}%`),
            eb("wsm.hierarchy_code", "like", `%${keyword}%`),
          ])
        )
      )
      .select([
        "wsema.entity_id",
        "wsm.id as material_id",
        "wsm.name as material_name",
        "wsm.material_level_id",
        "wsm.is_temperature_sensitive",
        "wsm.is_open_vial",
        "wsm.is_managed_in_batch",
        "wsm.unit_of_consumption",
        "wsm.consumption_unit_per_distribution_unit",
        "wsm.status as material_status",
        sql`COALESCE(wsema.min, 0)`.as("min"),
        sql`COALESCE(wsema.max, 0)`.as("max"),
        sql`COUNT(*) OVER ()`.as("total"),
      ])
      .orderBy(sql`lower(wsm.name)`)
      .groupBy(["wsema.entity_id", "wsm.id"])
      .limit(paginate)
      .offset(offset)
      .distinct()
      .execute()

    return {
      list,
      total: Number(list[0]?.total || 0),
    }
  }
}
