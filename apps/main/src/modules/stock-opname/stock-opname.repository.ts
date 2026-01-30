import {
  WsStockOpnames,
  WsMaterials,
  WsEntities,
  WsStocks,
  WsBatches,
  DB,
  Materials,
} from "@/common/infrastructure/database/types/db.js"
import { Context } from "hono"
import {
  Insertable,
  sql,
  SelectQueryBuilder,
  Nullable,
  InsertResult,
} from "kysely"
import _ from "lodash"
import { type z } from "zod"
import { BaseRepository } from "../base.repository.js"
import { GetStockOpnamesQueries } from "./stock-opname.schema.js"
import { CustomContext } from "@smile-health/lib/types/context.js"
import { associate } from "@smile-health/lib/utils.js"

type StockOpnamesQueries = z.infer<typeof GetStockOpnamesQueries>

export default class StockOpnameRepository extends BaseRepository<"ws_stock_opnames"> {
  constructor() {
    super("ws_stock_opnames", false, true)
  }

  #conditionStockOpnameWhereClause(
    query: SelectQueryBuilder<
      DB & { wsso: WsStockOpnames } & {
        wsm: WsMaterials | Materials
      } & {
        wse: Nullable<WsEntities>
      } & { wss: Nullable<WsStocks> } & { wsb: Nullable<WsBatches> },
      "wsso" | "wsm" | "wse" | "wss" | "wsb",
      object
    >,
    params: StockOpnamesQueries
  ) {
    const {
      period_id,
      entity_id,
      material_id,
      parent_material_id,
      material_type_id,
      activity_id,
      stock_id,
      batch_code,
      entity_tag_id,
      province_id,
      regency_id,
      expired_start_date,
      expired_end_date,
      created_from,
      created_to,
      only_have_qty,
      is_within_period,
    } = params

    if (period_id) {
      query = query.where("wsso.period_id", "=", period_id)
    }

    if (entity_id) {
      query = query.where("wsso.entity_id", "=", entity_id)
    }

    if (material_id) {
      query = query.where("wsso.material_id", "=", material_id)
    }

    if (parent_material_id) {
      query = query.where("wsso.parent_material_id", "=", parent_material_id)
    }

    if (material_type_id) {
      query = query.where((eb) =>
        eb("wsm.material_type_id", "=", material_type_id!)
      )
    }

    if (activity_id) {
      query = query.where("wsso.activity_id", "=", activity_id)
    }

    if (stock_id) {
      query = query.where("wsso.stock_id", "=", stock_id)
    }

    if (batch_code) {
      query = query.where("wsso.batch_code", "like", `%${batch_code}%`)
    }

    if (entity_tag_id) {
      query = query.where((eb) => eb("wse.entity_tag_id", "=", entity_tag_id!))
    }

    if (expired_start_date) {
      query = query.where((eb) =>
        eb("wsb.expired_date", ">=", expired_start_date!)
      )
    }

    if (expired_end_date) {
      query = query.where((eb) =>
        eb("wsb.expired_date", "<=", expired_end_date!)
      )
    }

    if (province_id) {
      query = query.where((eb) =>
        eb("wse.province_id", "=", String(province_id))
      )
    }

    if (regency_id) {
      query = query.where((eb) => eb("wse.regency_id", "=", String(regency_id)))
    }

    if (created_from) {
      query = query.where("wsso.created_at", ">=", created_from)
    }

    if (created_to) {
      query = query.where("wsso.created_at", "<=", created_to)
    }

    if (only_have_qty === 1) {
      query = query.where((eb) =>
        eb.or([
          eb("wsso.recorded_qty", ">", 0),
          eb("wsso.in_transit_qty", ">", 0),
          eb("wsso.actual_qty", ">", 0),
        ])
      )
    } else if (only_have_qty === 0) {
      query = query.where((eb) =>
        eb.and([
          eb("wsso.recorded_qty", "=", 0),
          eb("wsso.in_transit_qty", "=", 0),
          eb("wsso.actual_qty", "=", 0),
        ])
      )
    }

    if (is_within_period) {
      query = query.where("wsso.is_within_period", "=", is_within_period)
    }

    return query
  }

  async findAll(c: Context, params: StockOpnamesQueries) {
    let query = c.var.trx
      .selectFrom(`${this.tableName} as wsso`)
      .innerJoin("material_workspaces as mw", "mw.id", "wsso.material_id")
      .innerJoin("materials as wsm", "wsm.id", "mw.material_id")
      .leftJoin("ws_entities as wse", "wse.id", "wsso.entity_id")
      .leftJoin("ws_stocks as wss", "wss.id", "wsso.stock_id")
      .leftJoin("ws_batches as wsb", "wsb.id", "wss.batch_id")
      .where("wsso.deleted_at", "is", null)

    query = this.#conditionStockOpnameWhereClause(query, params)

    const countQuery = query.select((eb) => eb.fn.countAll().as("total"))
    const dataQuery = query
      .selectAll("wsso")
      .offset((params.page - 1) * params.paginate)
      .limit(params.paginate)
      .orderBy("wsso.updated_at", "desc")

    const [countResult, data] = await Promise.all([
      countQuery.executeTakeFirst(),
      dataQuery.execute(),
    ])

    return {
      data,
      total: Number(countResult?.total ?? 0),
    }
  }

  async getOpnameDates(
    c: Context,
    entityId: number,
    periodId?: number | null,
    isHierarchy: boolean = false
  ) {
    if (!periodId) {
      return {}
    }

    const materialCol = isHierarchy ? "parent_material_id" : "material_id"
    const result = await c.var.trx
      .selectFrom("ws_stock_opnames")
      .select(materialCol)
      .select(sql`max(updated_at)`.as("updated_at"))
      .where("entity_id", "=", entityId)
      .where("period_id", "=", periodId)
      .groupBy(materialCol)
      .execute()

    return _.mapValues(_.keyBy(result, materialCol), "updated_at")
  }

  async mappingDataCreateStockOpname(
    c: Context,
    data: Insertable<WsStockOpnames>[]
  ) {
    // Buat key unik (tanpa stock_id)
    const keys: [number, number, number, number, string][] = data.map((d) => [
      d.period_id ?? 0,
      d.entity_id ?? 0,
      d.material_id ?? 0,
      d.activity_id ?? 0,
      d.batch_code ?? "",
    ])

    // Ambil semua existing dalam 1 query
    const existRows = await c.var.trx
      .selectFrom(`${this.tableName} as wso`)
      .select([
        "wso.id",
        "wso.period_id",
        "wso.entity_id",
        "wso.material_id",
        "wso.activity_id",
        "wso.batch_code",
        "wso.stock_id",
      ])
      .where("wso.deleted_at", "is", null)
      .where((eb) =>
        eb.or(
          keys.map(([p, e, m, a, b]) =>
            eb.and([
              eb("wso.period_id", "=", p),
              eb("wso.entity_id", "=", e),
              eb("wso.material_id", "=", m),
              eb("wso.activity_id", "=", a),
              eb("wso.batch_code", "=", b),
            ])
          )
        )
      )
      .execute()

    // Masukkan ke Map
    // membuat Map key sesuai dengan is_managed_in_batch, jika managed in batch, key tanpa stock_id. case SO dulu baru add stock
    const existMap = new Map(
      existRows.map((r) => [
        `${r.period_id}-${r.entity_id}-${r.material_id}-${r.activity_id}-${r.batch_code}-${r.stock_id}`,
        r.id,
      ])
    )

    const dataInsert: Insertable<WsStockOpnames>[] = []
    const dataUpdate: Insertable<WsStockOpnames>[] = []

    for (const item of data) {
      // membuat key case SO dulu baru add stock
      const key = `${item.period_id}-${item.entity_id}-${item.material_id}-${item.activity_id}-${item.batch_code}-${item.stock_id || 0}`
      let existId = existMap.get(key)
      // check lagi apakah tidak ketemu existId. maka cari lagi tanpa stock_id. case SO dulu sebelum add stock
      existId = !existId
        ? existMap.get(
            `${item.period_id}-${item.entity_id}-${item.material_id}-${item.activity_id}-${item.batch_code}-0`
          )
        : existId
      // delete karena gak kepakek di insert atau update, bikin error kalo gak di delete
      if (existId) {
        dataUpdate.push({
          ...item,
          id: existId,
          updated_by: c.var.userId,
        })
      } else {
        dataInsert.push(item)
      }
    }

    return { dataInsert, dataUpdate }
  }

  async createMany(c: Context, data: Insertable<WsStockOpnames>[]) {
    const insertResult: InsertResult[] = []
    const { dataInsert, dataUpdate } = await this.mappingDataCreateStockOpname(
      c,
      data
    )

    if (dataInsert.length > 0) {
      const result = await c.var.trx
        .insertInto("ws_stock_opnames")
        .values(data)
        .onDuplicateKeyUpdate({
          recorded_qty: sql`values(recorded_qty)`,
          actual_qty: sql`values(actual_qty)`,
          in_transit_qty: sql`values(in_transit_qty)`,
          is_within_period: sql`values(is_within_period)`,
          updated_by: sql`values(updated_by)`,
        })
        .execute()
      insertResult.push(...(Array.isArray(result) ? result : [result]))
    }

    if (dataUpdate.length > 0) {
      for (const item of dataUpdate) {
        await c.var.trx
          .updateTable("ws_stock_opnames")
          .set({
            stock_id: item.stock_id,
            expired_date: item.expired_date,
            recorded_qty: item.recorded_qty,
            actual_qty: item.actual_qty,
            in_transit_qty: item.in_transit_qty,
            is_within_period: item.is_within_period,
            updated_by: item.updated_by,
          })
          .where("id", "=", item.id ?? 0)
          .execute()
      }
    }

    return insertResult
  }

  async getListOpnameStream(c: CustomContext<DB>, params: StockOpnamesQueries) {
    const query = c.var.trx
      .selectFrom("ws_stock_opnames as wsso")
      .innerJoin("material_workspaces as mw", "mw.id", "wsso.material_id")
      .innerJoin("materials as wsm", (join) =>
        join
          .onRef("wsm.id", "=", "mw.material_id")
          .on("wsm.deleted_at", "is", null)
      )
      .leftJoin("ws_entities as wse", (join) =>
        join
          .onRef("wse.id", "=", "wsso.entity_id")
          .on("wse.deleted_at", "is", null)
      )
      .leftJoin("ws_stocks as wss", (join) =>
        join
          .onRef("wss.id", "=", "wsso.stock_id")
          .on("wss.deleted_at", "is", null)
      )
      .leftJoin("ws_batches as wsb", (join) =>
        join
          .onRef("wsb.id", "=", "wss.batch_id")
          .on("wsb.deleted_at", "is", null)
      )

    const filteredQuery = this.#conditionStockOpnameWhereClause(query, params)

    const list = filteredQuery
      .leftJoin("locations as prov", "prov.id", "wse.province_id")
      .leftJoin("locations as reg", "reg.id", "wse.regency_id")
      .leftJoin("ws_users as wsu", "wsu.id", "wsso.created_by")
      .leftJoin("ws_activities as wsa", (join) =>
        join
          .onRef("wsa.id", "=", "wsso.activity_id")
          .on("wsa.deleted_at", "is", null)
      )
      .leftJoin("ws_stock_opname_periods as wssop", (join) =>
        join
          .onRef("wssop.id", "=", "wsso.period_id")
          .on("wssop.deleted_at", "is", null)
      )
      .where("wsso.deleted_at", "is", null)
      .select([
        "wsso.batch_code as batch_code",
        "wsso.expired_date as expired_date",
        "wsso.created_at",
        "wsso.recorded_qty",
        "wsso.in_transit_qty",
        "wsso.actual_qty",
        "wsso.is_within_period",
        "wse.name as entity_name",
        "prov.name as province",
        "reg.name as regency",
        "wsm.name as material_name",
        sql<string>`CONCAT_WS('', wsu.firstname, wsu.lastname)`.as("full_name"),
        "wsa.name as activity_name",
        "wssop.start_date",
        "wssop.end_date",
        "wssop.month_period",
        "wssop.year_period",
        "wssop.status as period_status",
      ])
      .orderBy("wsso.updated_at", "desc")
      .orderBy("wsso.id")
      .stream()

    return list
  }

  async getMaterialByIds(c: Context, ids: number[]) {
    const materials = await c.var.trx
      .selectFrom("ws_materials")
      .select(["id", "is_managed_in_batch"])
      .where("deleted_at", "is", null)
      .where("id", "in", ids.length ? ids : [0])
      .execute()
    return associate(materials, "id")
  }
}
