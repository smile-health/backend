import { DATASOURCE } from "@/common/constants/common.js"
import { KFA_LEVEL_ID } from "@/common/constants/material.js"
import { TRANSACTION_TYPE } from "@/common/constants/transaction.js"
import { db } from "@/common/infrastructure/database/index.js"
import { Datamart } from "@/common/infrastructure/database/types/datamart.js"
import { DB } from "@/common/infrastructure/database/types/db.js"
import env from "@/config/env.js"
import { CustomContext } from "@smile-health/lib/types/context.js"
import { Context } from "hono"
import { Kysely, sql, CompiledQuery } from "kysely"
import _ from "lodash"
import { BaseRepository } from "../base.repository.js"
import {
  CreateStockDTO,
  GetEntityStocksQueries,
  GetStockDetailsQueries,
  GetStocksQueries,
} from "./stock.schema.js"

export class StockRepository extends BaseRepository<"ws_stocks"> {
  constructor() {
    super("ws_stocks", false, true)
  }

  #isFilterEntity(params: GetStocksQueries) {
    return !!params.entity_tag_id || !!params.province_id || !!params.regency_id
  }

  #isFilterBatch(params: GetStocksQueries) {
    return !!params.expired_start_date || !!params.expired_end_date
  }

  async findAll(c: Context, params: GetStocksQueries) {
    const isTemplate =
      (c.var.config?.material.is_hierarchy_enabled &&
        params.material_level_id !== KFA_LEVEL_ID.VARIANT) ??
      false

    const source = env.STOCK_LIST_SOURCE
    const useSlave = [DATASOURCE.DATAMART, DATASOURCE.CLICKHOUSE].includes(
      source
    )
    const like = useSlave ? "ilike" : "like"
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

    const filterBatch = this.#isFilterBatch(params)
    const filterEntity = this.#isFilterEntity(params)

    // skip stock check query for only_have_qty = 0, only for add stock transaction only
    const stockQuery = conn
      .selectFrom(
        useDatamart ? sql`raw_ws_stocks as s FINAL` : "ws_stocks as s"
      )
      .select([
        "s.entity_id",
        "m.id as material_id",
        sql`sum(qty)`.as("total_qty"),
        sql`sum(in_transit_qty)`.as("total_in_transit_qty"),
        sql`sum(allocated_qty)`.as("total_allocated_qty"),
        sql`sum(qty - allocated_qty)`.as("total_available_qty"),
        sql`sum(open_vial_qty)`.as("total_open_vial_qty"),
        sql`sum(exterminated_qty)`.as("total_exterminated_qty"),
        sql`sum(unreceived_qty)`.as("total_unreceived_qty"),
        sql`max(s.updated_at)`.as("updated_at"),
        sql`COUNT(*) OVER ()`.as("total"),
      ])
      .innerJoin(
        useDatamart ? "raw_ws_materials as m" : "ws_materials as m",
        "m.id",
        isTemplate ? "s.parent_material_id" : "s.material_id"
      )
      .where("s.deleted_at", "is", null)
      .where("s.entity_id", "is not", null)
      .where("m.deleted_at", "is", null)
      .where("m.status", "=", 1)
      .where("m.program_id", "=", c.var.programId)
      .$if(!!params.entity_id, (qb) =>
        qb.where("s.entity_id", "=", params.entity_id ?? 0)
      )
      .$if(!!params.material_id && params.material_id.length > 0, (qb) =>
        qb
          .$if(isTemplate, (qb) =>
            qb.where("s.parent_material_id", "in", params.material_id ?? [-1])
          )
          .$if(!isTemplate, (qb) =>
            qb.where("s.material_id", "in", params.material_id ?? [-1])
          )
      )
      .$if(!!params.batch_ids && params.batch_ids.length > 0, (qb) =>
        qb.where("s.batch_id", "in", params.batch_ids ?? [-1])
      )
      .$if(!!params.activity_id, (qb) =>
        qb.where("s.activity_id", "=", params.activity_id ?? 0)
      )
      .$if(!!params.only_have_qty, (qb) => qb.where("s.qty", ">", 0))
      .$if(!!params.material_type_id, (qb) =>
        qb.where("m.material_type_id", "=", params.material_type_id ?? 0)
      )
      .$if(!!params.material_level_id, (qb) =>
        qb.where("m.material_level_id", "=", params.material_level_id ?? 0)
      )
      .$if(!!params.keyword, (qb) =>
        qb.where((eb) =>
          eb.or([
            eb("m.name", like, `%${params.keyword}%`),
            eb("m.code", like, `%${params.keyword}%`),
            eb("m.hierarchy_code", like, `%${params.keyword}%`),
          ])
        )
      )
      .$if(filterEntity, (qb) =>
        qb
          .innerJoin(
            useDatamart ? "raw_ws_entities as e" : "ws_entities as e",
            "e.id",
            "s.entity_id"
          )
          .$if(!!params.entity_tag_id, (qb) =>
            qb.where("e.entity_tag_id", "=", params.entity_tag_id ?? 0)
          )
          .$if(!!params.province_id, (qb) =>
            qb.where("e.province_id", "=", String(params.province_id))
          )
          .$if(!!params.regency_id, (qb) =>
            qb.where("e.regency_id", "=", String(params.regency_id))
          )
      )
      .$if(filterBatch, (qb) =>
        qb
          .innerJoin(
            useDatamart ? "raw_ws_batches as b" : "ws_batches as b",
            "b.id",
            "s.batch_id"
          )
          .$if(!!params.expired_start_date, (qb) =>
            qb.where((eb) =>
              eb.or([
                eb(
                  "b.expired_date",
                  ">=",
                  (params.expired_start_date as unknown as Date) ?? null
                ),
                eb("b.expired_date", "is", null),
              ])
            )
          )
          .$if(!!params.expired_end_date, (qb) =>
            qb.where((eb) =>
              eb.or([
                eb(
                  "b.expired_date",
                  "<=",
                  (params.expired_end_date as unknown as Date) ?? null
                ),
                eb("b.expired_date", "is", null),
              ])
            )
          )
      )

    const page = params.page ?? 1
    const paginate = params.paginate ?? 10
    const offset = (page - 1) * paginate

    const {
      sql: _sql,
      parameters,
      query,
    } = stockQuery
      .orderBy(sql`lower(m.name)`)
      .orderBy("s.entity_id")
      .groupBy(["s.entity_id", "material_id", "m.name"])
      .limit(paginate)
      .offset(offset)
      .compile()

    const preWhereStocks: string[] = []

    if (params.entity_id) {
      preWhereStocks.push(`s.entity_id = ${params.entity_id}`)
    }

    if (params.material_id && params.material_id.length > 0) {
      const materialIds = params.material_id.join(",")
      if (isTemplate) {
        preWhereStocks.push(`s.parent_material_id in (${materialIds})`)
      }

      if (!isTemplate) {
        preWhereStocks.push(`s.material_id in (${materialIds})`)
      }
    }

    const preWhereDefault: string[] = []

    if (c.var.programId) {
      preWhereDefault.push(`m.program_id = ${c.var.programId}`)
    }

    const preWhereClause =
      preWhereStocks.length > 0
        ? preWhereStocks.join(" AND ")
        : preWhereDefault.join(" AND ")

    const newSql = useDatamart
      ? _sql.replace("where", `prewhere ${preWhereClause} where`)
      : _sql

    const { rows } = await conn.executeQuery({
      sql: newSql,
      parameters,
      query,
    })

    return {
      data: rows,
      total: Number(rows[0]?.total),
    }
  }

  async findActivities(c: Context, entityId: number, materialId: number) {
    return await c.var.trx
      .selectFrom("ws_entity_material_activities as ema")
      .innerJoin("ws_activities as a", "a.id", "ema.activity_id")
      .select(["a.id", "a.name"])
      .where("ema.material_id", "=", materialId)
      .where("ema.entity_id", "=", entityId)
      .where("a.program_id", "=", c.var.programId)
      .distinct()
      .execute()
  }

  async findEntityMaterials(c: Context, params: GetEntityStocksQueries) {
    // for hierarchy, we just store kfa 92 material id in ema, so need to join with parent_id
    const isVariant =
      c.var.config?.material.is_hierarchy_enabled &&
      params.material_level_id !== KFA_LEVEL_ID.TEMPLATE

    const isAllowedtoAddStockOnly =
      params.is_addremove === 1 &&
      params.material_level_id !== KFA_LEVEL_ID.TEMPLATE

    const query = c.var.trx
      .selectFrom("ws_entity_material_activities as ema")
      .innerJoin(
        "ws_materials as m",
        isVariant ? "m.parent_id" : "m.id",
        "ema.material_id"
      )
      .select([
        "ema.entity_id",
        "m.id as material_id",
        sql`COALESCE(ema.min, 0)`.as("min"),
        sql`COALESCE(ema.max, 0)`.as("max"),
        sql`COUNT(*) OVER ()`.as("total"),
      ])
      .where("m.program_id", "=", c.var.programId)
      .where("m.material_level_id", "=", params.material_level_id ?? 0)
      .where("ema.entity_id", "=", params.entity_id ?? 0)
      .$if(!!params.activity_id, (qb) =>
        qb
          .select("ema.activity_id")
          .where("ema.activity_id", "=", params.activity_id ?? 0)
      )
      .$if(isAllowedtoAddStockOnly, (qb) =>
        qb.where((eb) =>
          eb.and([
            eb.exists(
              c.var.trx
                .selectFrom("ws_material_permissions as mp")
                .select("mp.id")
                .whereRef("mp.material_id", "=", "m.id")
                .where("mp.action", "=", TRANSACTION_TYPE.ADD_STOCK)
                .where((eb) =>
                  eb.and([
                    eb("mp.key", "=", "roles"),
                    eb("mp.value", "=", c.var.user?.role ?? 0),
                  ])
                )
            ),
            eb.exists(
              c.var.trx
                .selectFrom("ws_material_permissions as mp")
                .select("mp.id")
                .whereRef("mp.material_id", "=", "m.id")
                .where("mp.action", "=", TRANSACTION_TYPE.ADD_STOCK)
                .where((eb) =>
                  eb.and([
                    eb("mp.key", "=", "entity_types"),
                    eb("mp.value", "=", c.var.userEntity.type),
                  ])
                )
            ),
          ])
        )
      )
      .where("ema.deleted_at", "is", null)
      .where("m.deleted_at", "is", null)
      .where("m.status", "=", 1)
      .$if(!!params.keyword, (qb) =>
        qb.where((eb) =>
          eb.or([
            eb("m.name", "like", `%${params.keyword}%`),
            eb("m.code", "like", `%${params.keyword}%`),
            eb("m.hierarchy_code", "like", `%${params.keyword}%`),
          ])
        )
      )
      .$if(!!params.material_id, (qb) =>
        qb.where("ema.material_id", "in", params.material_id ?? [-1])
      )

    const page = params.page ?? 1
    const paginate = params.paginate ?? 10
    const offset = (page - 1) * paginate
    const [stocks] = await Promise.all([
      query
        .$if(!!params.period_id, (qb) =>
          qb
            .leftJoin("ws_stocks as s", (join) =>
              join
                .onRef("ema.entity_id", "=", "s.entity_id")
                .onRef("m.id", "=", "s.material_id")
                .onRef("ema.activity_id", "=", "s.activity_id")
            )
            .select(sql`SUM(COALESCE(s.qty, 0))`.as("total_qty"))
            .orderBy("m.is_stock_opname_mandatory", "desc")
            .orderBy("total_qty", "desc")
        )
        .orderBy(sql`lower(m.name)`)
        .groupBy(["ema.entity_id", "m.id"])
        .limit(paginate)
        .offset(offset)
        .distinct()
        .execute(),
    ])

    return {
      data: stocks,
      total: Number(stocks[0]?.total),
    }
  }

  async findEntityMaterialsSort(c: Context, params: GetEntityStocksQueries) {
    const page = params.page ?? 1
    const paginate = params.paginate ?? 10
    const offset = (page - 1) * paginate

    let keyword = ``
    if (params.keyword) {
      keyword = ` AND (m.name LIKE '%${params.keyword}%' OR m.code LIKE '%${params.keyword}%' OR m.hierarchy_code LIKE '%${params.keyword}%') `
    }

    // for hierarchy, we just store kfa 92 material id in ema, so need to join with parent_id
    const stocks: any = await db.executeQuery(
      CompiledQuery.raw(`
            WITH ema_with_stocks AS (
              select
              saaa.entity_id,
              m.id as material_id,
              sum(qty) as total_qty,
              sum(in_transit_qty) as total_in_transit_qty,
              sum(allocated_qty) as total_allocated_qty,
              sum(qty - allocated_qty) as total_available_qty,
              sum(open_vial_qty) as total_open_vial_qty,
              sum(exterminated_qty) as total_exterminated_qty,
              sum(unreceived_qty) as total_unreceived_qty,
              max(saaa.updated_at) as updated_at,
              COUNT(*) OVER () as total
            from
              ws_stocks as saaa
            inner join ws_materials as m on
              m.id = saaa.parent_material_id
            where
              saaa.deleted_at is null
              and saaa.entity_id is not null
              and m.deleted_at is null
              and m.status = 1
              and m.program_id = ${c.var.programId}
              and saaa.entity_id = ${params.entity_id ?? 0}
              and m.material_level_id = ${params.material_level_id ?? 0}
            group by
              saaa.entity_id,
              m.id,
              m.name
            order by
            total_qty desc,
              lower(m.name),
              saaa.entity_id
            )
            select
              distinct ema.entity_id,
              m.id as material_id,
              m.material_level_id,
              m.program_id,
              COALESCE(ema.min, 0) as min,
              COALESCE(ema.max, 0) as max,
              COUNT(*) OVER () as total,
              total_in_transit_qty,
              total_allocated_qty,
              total_available_qty,
              total_open_vial_qty,
              total_exterminated_qty,
              total_unreceived_qty,
              total_qty
            from
              ws_entity_material_activities as ema
            inner join ws_materials as m on
              m.id = ema.material_id
            left join ema_with_stocks aaa on aaa.entity_id=ema.entity_id and aaa.material_id=m.id
            where
              m.program_id = ${c.var.programId}
              and m.material_level_id = ${params.material_level_id ?? 0}
              and ema.entity_id = ${params.entity_id ?? 0}
              and ema.deleted_at is null
              and m.deleted_at is null
              and m.status = 1
              ${keyword}
            group by
              ema.entity_id,
              m.id
            order by
            total_qty desc,
              lower(m.name)
            limit ${paginate} offset ${offset}
              `)
    )
    console.log(`DEBUG findEntityMaterialsSort SQL executed:`, {
      num: stocks.numAffectedRows,
      nim: stocks.rows.length,
      nam: stocks.numChangedRows,
    })
    return {
      data: stocks.rows,
      total: Number(stocks.rows?.length ? stocks.rows[0].total : 0),
    }
  }

  async getHierarchyStreamData(c: Context, params: GetStocksQueries) {
    const filterBatch = this.#isFilterBatch(params)
    return c.var.trx
      .selectFrom("ws_stocks as s")
      .leftJoin("ws_materials as m", "m.id", "s.parent_material_id")
      .leftJoin("ws_entities as e", "e.id", "s.entity_id")
      .leftJoin("entity_types as et", "et.id", "e.type")
      .leftJoin("locations as prov", "prov.id", "e.province_id")
      .leftJoin("locations as reg", "reg.id", "e.regency_id")
      .leftJoin("locations as sub", "sub.id", "e.sub_district_id")
      .leftJoin("ws_entity_material_activities as wema", (join) =>
        join
          .onRef("s.parent_material_id", "=", "wema.material_id")
          .onRef("s.entity_id", "=", "wema.entity_id")
          .onRef("s.activity_id", "=", "wema.activity_id")
      )
      .select([
        "e.id",
        "e.name as entity",
        "prov.name as province",
        "reg.name as regency",
        "sub.name as subdistrict",
        "et.name as entity_type",
        "m.name as material_name",
        "m.hierarchy_code as material_hierarchy_code",
        "m.code as material_code",
        sql`sum(qty)`.as("total_qty"), //
        sql`sum(allocated_qty)`.as("total_allocated_qty"), //
        sql`sum(qty - allocated_qty)`.as("total_available_qty"), //
        "wema.min as min", //
        "wema.max as max", //
      ])
      .where("s.entity_id", "is not", null)
      .where("e.name", "is not", null)
      .where("e.deleted_at", "is", null)
      .where("m.deleted_at", "is", null)
      .where("m.status", "=", 1)
      .where("m.program_id", "=", params.program_id ?? c.var.programId)
      .$if(!!params.only_have_qty, (qb) => qb.where("s.qty", ">", 0))
      .$if(!!params.activity_id, (qb) =>
        qb.where("s.activity_id", "=", params.activity_id ?? 0)
      )
      .$if(!!params.entity_id, (qb) =>
        qb.where("s.entity_id", "=", params.entity_id ?? 0)
      )
      .$if(!!params.material_id && params.material_id.length > 0, (qb) =>
        qb.where("s.parent_material_id", "in", params.material_id ?? [-1])
      )
      .$if(!!params.material_type_id, (qb) =>
        qb.where("m.material_type_id", "=", params.material_type_id ?? 0)
      )
      .$if(!!params.keyword, (qb) =>
        qb.where((eb) =>
          eb.or([
            eb("m.name", "like", `%${params.keyword}%`),
            eb("m.code", "like", `%${params.keyword}%`),
            eb("m.hierarchy_code", "like", `%${params.keyword}%`),
          ])
        )
      )
      .$if(!!params.entity_tag_id, (qb) =>
        qb.where("e.entity_tag_id", "=", params.entity_tag_id ?? 0)
      )
      .$if(!!params.province_id, (qb) =>
        qb.where("e.province_id", "=", String(params.province_id))
      )
      .$if(!!params.regency_id, (qb) =>
        qb.where("e.regency_id", "=", String(params.regency_id))
      )
      .$if(filterBatch, (qb) =>
        qb
          .innerJoin("ws_batches as b", "b.id", "s.batch_id")
          .$if(!!params.expired_start_date, (qb) =>
            qb.where((eb) =>
              eb.or([
                eb(
                  "b.expired_date",
                  ">=",
                  (params.expired_start_date as unknown as Date) ?? null
                ),
                eb("b.expired_date", "is", null),
              ])
            )
          )
          .$if(!!params.expired_end_date, (qb) =>
            qb.where((eb) =>
              eb.or([
                eb(
                  "b.expired_date",
                  "<=",
                  (params.expired_end_date as unknown as Date) ?? null
                ),
                eb("b.expired_date", "is", null),
              ])
            )
          )
      )
      .orderBy(sql`lower(m.name)`)
      .orderBy("s.entity_id")
      .groupBy(["s.entity_id", "m.name"])
      .stream()
  }

  async getStreamData(
    c: Context,
    params: GetStocksQueries,
    isHierarchy = false
  ) {
    return c.var.trx
      .selectFrom("ws_stocks as s")
      .innerJoin("ws_materials as m", "m.id", "s.material_id")
      .innerJoin("ws_entities as e", "e.id", "s.entity_id")
      .innerJoin("ws_activities as a", "a.id", "s.activity_id")
      .leftJoin("ws_materials as p", "s.parent_material_id", "p.id")
      .leftJoin("entity_types as et", "et.id", "e.type")
      .leftJoin("locations as prov", "prov.id", "e.province_id")
      .leftJoin("locations as reg", "reg.id", "e.regency_id")
      .leftJoin("locations as sub", "sub.id", "e.sub_district_id")
      .leftJoin("ws_entity_material_activities as ema", (join) =>
        join
          .onRef("s.entity_id", "=", "ema.entity_id")
          .onRef(
            isHierarchy ? "s.parent_material_id" : "s.material_id",
            "=",
            "ema.material_id"
          )
          .onRef("s.activity_id", "=", "ema.activity_id")
      )
      .leftJoin("ws_batches as b", "s.batch_id", "b.id")
      .leftJoin("ws_manufactures as mf", "mf.id", "b.manufacture_id")
      .leftJoin("ws_budget_sources as bs", "bs.id", "s.budget_source_id")
      .where("s.deleted_at", "is", null)
      .where("m.deleted_at", "is", null)
      .where("m.status", "=", 1)
      .where("e.deleted_at", "is", null)
      .where("e.name", "is not", null)
      .where("a.program_id", "=", c.var.programId || params.program_id)
      .$if(!!params.entity_id, (qb) =>
        qb.where("s.entity_id", "=", params.entity_id ?? 0)
      )
      .$if(!!params.material_id && params.material_id.length > 0, (qb) =>
        qb.where("s.parent_material_id", "in", params.material_id ?? [-1])
      )
      .$if(!!params.batch_ids && params.batch_ids.length > 0, (qb) =>
        qb.where("s.batch_id", "in", params.batch_ids ?? [-1])
      )
      .$if(!!params.activity_id, (qb) =>
        qb.where("s.activity_id", "=", params.activity_id ?? 0)
      )
      .$if(!!params.only_have_qty, (qb) => qb.where("s.qty", ">", 0))
      .$if(!!params.material_type_id, (qb) =>
        qb.where("m.material_type_id", "=", params.material_type_id ?? 0)
      )
      .$if(!!params.keyword, (qb) =>
        qb.where((eb) =>
          eb.or([
            eb("m.name", "like", `%${params.keyword}%`),
            eb("m.code", "like", `%${params.keyword}%`),
            eb("m.hierarchy_code", "like", `%${params.keyword}%`),
          ])
        )
      )
      .$if(!!params.entity_tag_id, (qb) =>
        qb.where("e.entity_tag_id", "=", params.entity_tag_id ?? 0)
      )
      .$if(!!params.province_id, (qb) =>
        qb.where("e.province_id", "=", String(params.province_id))
      )
      .$if(!!params.regency_id, (qb) =>
        qb.where("e.regency_id", "=", String(params.regency_id))
      )
      .$if(!!params.expired_start_date, (qb) =>
        qb.where((eb) =>
          eb.or([
            eb(
              "b.expired_date",
              ">=",
              (params.expired_start_date as unknown as Date) ?? null
            ),
            eb("b.expired_date", "is", null),
          ])
        )
      )
      .$if(!!params.expired_end_date, (qb) =>
        qb.where((eb) =>
          eb.or([
            eb(
              "b.expired_date",
              "<=",
              (params.expired_end_date as unknown as Date) ?? null
            ),
            eb("b.expired_date", "is", null),
          ])
        )
      )
      .select([
        "e.id",
        "e.name as entity",
        "prov.name as province",
        "reg.name as regency",
        "sub.name as subdistrict",
        "et.name as entity_type",
        "p.name as parent_material",
        "m.name as material",
        "m.hierarchy_code as material_hierarchy_code",
        "m.code as material_code",
        "b.code",
        "b.expired_date",
        "a.name as activity",
        "s.qty",
        "ema.min",
        "ema.max",
        "s.price",
        "s.total_price",
        "bs.name as budget_source",
        "s.year",
      ])
      .orderBy(["e.name", "m.name"])
      .groupBy("s.id")
      .stream()
  }

  async findDetails(c: Context, params: GetStockDetailsQueries) {
    const isVariant =
      c.var.config?.material.is_hierarchy_enabled && !params.parent_material_id

    return await c.var.trx
      .selectFrom("ws_materials as ma")
      .innerJoin(
        "ws_entity_material_activities as ema",
        "ma.parent_id",
        "ema.material_id"
      )
      .leftJoin("ws_stocks as s", (join) =>
        join
          .onRef("s.entity_id", "=", "ema.entity_id")
          .onRef("s.material_id", "=", "ma.id")
          .onRef("s.activity_id", "=", "ema.activity_id")
          .on("s.deleted_at", "is", null)
      )
      .leftJoin("ws_batches as b", "s.batch_id", "b.id")
      .leftJoin("ws_manufactures as m", "m.id", "b.manufacture_id")
      .leftJoin("ws_budget_sources as bs", "bs.id", "s.budget_source_id")
      .selectAll("s")
      .select([
        "ema.entity_id",
        "ma.id as material_id",
        "ema.activity_id",
        sql<number>`qty * price`.as("total_price"),
        sql`coalesce(ema.min, 0)`.as("min"),
        sql`coalesce(ema.max, 0)`.as("max"),
        sql`qty - allocated_qty`.as("available_qty"),
        sql`if(b.id is null, null, json_object(
          'id', b.id,
          'code', b.code,
          'production_date', b.production_date,
          'expired_date', b.expired_date,
          'manufacture', json_object(
            'id', m.id,
            'name', m.name,
            'address', m.address
          )
        ))`.as("batch"),
        sql`if(bs.id is null, null, json_object(
          'id', bs.id,
          'name', bs.name,
          'is_restricted', bs.is_restricted
        ))`.as("budget_source"),
      ])
      .where("ema.entity_id", "=", params.entity_id)
      .$if(!params.material_ids, (qb) =>
        qb.where(
          isVariant ? "ma.id" : "ma.parent_id",
          "=",
          params.parent_material_id ?? params.material_id ?? 0
        )
      )
      .$if(!!params.activity_id, (qb) =>
        qb.where("ema.activity_id", "=", params.activity_id ?? 0)
      )
      .$if(!!params.only_have_qty, (qb) => qb.where("s.qty", ">", 0))
      .$if(!!params.expired_start_date, (qb) =>
        qb.where((eb) =>
          eb.or([
            eb(
              "b.expired_date",
              ">=",
              (params.expired_start_date as unknown as Date) ?? null
            ),
            eb("b.expired_date", "is", null),
          ])
        )
      )
      .$if(!!params.expired_end_date, (qb) =>
        qb.where((eb) =>
          eb.or([
            eb(
              "b.expired_date",
              "<=",
              (params.expired_end_date as unknown as Date) ?? null
            ),
            eb("b.expired_date", "is", null),
          ])
        )
      )
      .$if(!!params.batch_ids && params.batch_ids.length > 0, (qb) =>
        qb.where("s.batch_id", "in", params.batch_ids ?? [-1])
      )
      .$if(!!params.stock_ids && params.stock_ids.length > 0, (qb) =>
        qb.where("s.id", "in", params.stock_ids ?? [-1])
      )
      .$if(!!params.material_ids && params.material_ids.length > 0, (qb) =>
        qb.where("m.id", "in", params.material_ids ?? [-1])
      )
      .where("ema.deleted_at", "is", null)
      .where("ma.deleted_at", "is", null)
      .orderBy("s.qty", "desc")
      .distinct()
      .execute()
  }

  async findMinMax(
    c: Context,
    entityMaterials: number[][],
    activityId?: number
  ) {
    if (entityMaterials.length === 0) return {}

    const tupleList = entityMaterials.map((em) => sql`(${em[0]},${em[1]})`)

    const result = await c.var.trx
      .selectFrom("ws_entity_material_activities as ema")
      .select([
        "ema.entity_id",
        "ema.material_id",
        sql`sum(min)`.as("min"),
        sql`sum(max)`.as("max"),
      ])
      .where(sql`(ema.entity_id, ema.material_id)`, "in", tupleList)
      .$if(!!activityId, (qb) =>
        qb.where("ema.activity_id", "=", Number(activityId))
      )
      .groupBy(["entity_id", "material_id"])
      .execute()

    return _.mapValues(_.groupBy(result, "entity_id"), (items) =>
      _.mapValues(_.groupBy(items, "material_id"), (group) => ({
        min: group[0]?.min,
        max: group[0]?.max,
      }))
    )
  }

  async createStock(c: Context, data: CreateStockDTO): Promise<number> {
    const result = await c.var.trx
      .insertInto("ws_stocks")
      .values(data)
      .executeTakeFirst()

    return Number(result?.insertId)
  }

  async createDummyStock(
    c: Context,
    entityId: number,
    materialId: number,
    activityId: number,
    parentMaterialId: number | null = null
  ) {
    if (c.var.config?.material.is_hierarchy_enabled && !parentMaterialId) {
      return
    }

    await c.var.trx
      .insertInto("ws_stocks")
      .values({
        entity_id: entityId,
        material_id: materialId,
        activity_id: activityId,
        parent_material_id: parentMaterialId,
        qty: 0,
        allocated_qty: 0,
        deleted_at: new Date(),
      })
      .executeTakeFirst()
  }

  // used by app mobile data
  async getEntityMaterialStockHierarchy(
    c: Context,
    entityId: number,
    materialIds: number[]
  ) {
    const query = c.var.trx
      .selectFrom("ws_stocks as ws")
      .innerJoin("ws_materials as m", "m.id", "ws.material_id")
      .where("ws.deleted_at", "is", null)
      .where("ws.entity_id", "is not", null)
      .where("ws.material_id", "is not", null)
      .where("m.program_id", "=", c.var.programId)
      .$if(entityId > 0, (qb) => qb.where("ws.entity_id", "=", entityId))
      .$if(!!materialIds && materialIds.length > 0, (qb) =>
        qb.where("ws.material_id", "in", materialIds ?? [-1])
      )

    const stocks = await query
      .select([
        "ws.id as stock_id",
        "ws.material_id as material_id",
        "ws.batch_id",
        "ws.activity_id",
        "ws.qty",
        "ws.allocated_qty as allocated",
        "ws.in_transit_qty as in_transit",
        sql`ws.qty - ws.allocated_qty`.as("available"),
        "ws.open_vial_qty as open_vial",
        "ws.year",
        "ws.price",
        "ws.total_price",
        "ws.budget_source_id",
        "ws.created_by as created_by",
        "ws.updated_by as updated_by",
        "ws.created_at as created_at",
        "ws.updated_at as updated_at",
      ])
      .execute()

    return stocks
  }

  // use by app module data
  async getEntityMaterialCalculateStocks(
    entityId: number,
    materialIds: number[],
    programId: number,
    is_hierarchy: boolean
  ) {
    return await db
      .selectFrom(
        is_hierarchy
          ? "ws_entity_material_hierarchy_stocks"
          : "ws_entity_material_stocks"
      )
      .where("entity_id", "=", Number(entityId))
      .where("material_id", "in", materialIds)
      .where("program_id", "=", programId)
      .selectAll()
      .execute()
  }

  // use by app data module
  async getStockEd(c: Context, entityId: number, expiredDate: Date) {
    const stockEd = await c.var.trx
      .selectFrom("ws_stocks as ws")
      .innerJoin("ws_batches as wb", "wb.id", "ws.batch_id")
      .where("wb.expired_date", "<=", expiredDate)
      .innerJoin("ws_entity_material_activities as wema", (join) =>
        join
          .onRef("ws.entity_id", "=", "wema.entity_id")
          .onRef("ws.material_id", "=", "wema.material_id")
          .onRef("ws.activity_id", "=", "wema.activity_id")
      )
      .innerJoin("ws_materials as wm", "wm.id", "wema.material_id")
      .innerJoin("ws_activities as wa", "wa.id", "wema.activity_id")
      .where("wema.entity_id", "=", entityId)
      .where("ws.qty", ">", 0)
      .selectAll("ws")
      .select([
        "ws.id as stock_id",
        "ws.qty as qty",
        "wb.code as batch_code",
        "wb.expired_date as batch_expired_date",
        "wm.name as material_name",
        "wm.id as material_id",
        "wa.id as activity_id",
        "wa.name as activity_name",
      ])
      .execute()
    return stockEd
  }

  async getEntityMaterialActivityMinMax(
    c: CustomContext<DB>,
    limit: number = 100,
    offset: number = 0,
    isHierarchy: boolean,
    entityIds: number[] = []
  ) {
    const result = await c.var.trx
      .selectFrom("ws_entity_material_activities as wema")
      .innerJoin("ws_materials as wm", (join) =>
        join
          .onRef("wm.id", "=", "wema.material_id")
          .on("wm.deleted_at", "is", null)
      )
      .innerJoin("ws_entities as we", (join) =>
        join
          .onRef("we.id", "=", "wema.entity_id")
          .on("we.deleted_at", "is", null)
      )
      .leftJoin("locations as loc", "loc.id", "we.regency_id")
      .select([
        "wema.id",
        "wema.entity_id",
        "wema.material_id",
        "wema.activity_id",
        sql<number>`sum(wema.min)`.as("min"),
        sql<number>`sum(wema.max)`.as("max"),
        "wm.program_id",
        "wm.name as material_name",
        "wm.unit_of_consumption as material_consumption_unit",
        "we.name as customer_entity_name",
        sql<string>`CASE WHEN we.type = 3 THEN loc.name ELSE '' END`.as(
          "regency_name"
        ),
        "wm.material_type_id",
      ])
      .$if(entityIds.length > 0, (eb) =>
        eb.where("wema.entity_id", "in", entityIds!)
      )
      .where("wema.deleted_at", "is", null)
      .where("wema.min", ">", 0)
      .where("we.type", "in", [1, 2, 3])
      .$if(isHierarchy, (eb) => eb.where("wm.material_level_id", "=", 2))
      .orderBy("wema.id", "asc")
      .groupBy(["wema.entity_id", "wema.material_id"])
      .limit(limit)
      .offset(offset)
      .execute()

    return result
  }

  async getStockOnHandFromEntityMaterialActivity(
    c: CustomContext<DB>,
    entityId: number,
    parentMaterialId: number,
    isHierarchy: boolean
  ) {
    const result = await c.var.trx
      .selectFrom("ws_stocks as ws")
      .leftJoin("ws_materials as wm", (join) =>
        join.onRef("wm.id", "=", "ws.material_id")
      )
      .select((eb) => [
        eb.fn.sum("ws.qty").as("stock_on_hand"),
        eb.fn.max("ws.updated_at").as("updated_at"),
      ])
      .where("ws.deleted_at", "is", null)
      .where("ws.entity_id", "=", entityId)
      .where("wm.status", "=", 1)
      .$if(isHierarchy, (eb) => eb.where("wm.parent_id", "=", parentMaterialId))
      .executeTakeFirst()

    return result
  }

  async getStockExpired(
    c: CustomContext<DB>,
    limit: number = 100,
    offset: number = 0,
    entityIds?: number[]
  ) {
    const numberOfDays = [1, 3, 10, 14, 30, 60, 90]
    return c.var.trx
      .selectFrom("ws_stocks as wss")
      .innerJoin("ws_materials as wsm", "wsm.id", "wss.material_id")
      .innerJoin("ws_entities as wse", "wse.id", "wss.entity_id")
      .leftJoin("ws_batches as wsb", "wsb.id", "wss.batch_id")
      .leftJoin("locations as loc", "loc.id", "wse.regency_id")
      .select([
        "wss.id",
        "wss.batch_id",
        "wss.qty as current_stock",
        "wsb.code as batch_number",
        "wsb.expired_date as batch_expired_date",
        "wsm.id as material_id",
        "wsm.name as material_name",
        "wsm.unit_of_consumption as material_consumption_unit",
        "wse.id as entity_id",
        "wse.name as customer_entity_name",
        "loc.id as regency_id",
        sql<string>`CASE WHEN wse.type = 3 THEN loc.name ELSE '' END`.as(
          "regency_name"
        ),
        sql<number>`DATEDIFF(wsb.expired_date, CURDATE())`.as("number_of_days"),
        "wsm.material_type_id",
      ])
      .where("wss.deleted_at", "is", null)
      .where("wss.batch_id", "is not", null)
      .where("wss.qty", ">", 0)
      .$if(entityIds && entityIds.length > 0, (eb) =>
        eb.where("wss.entity_id", "in", entityIds!)
      )
      .having(sql`DATEDIFF(wsb.expired_date, CURDATE())`, "in", numberOfDays)
      .orderBy("wss.created_at", "desc")
      .limit(limit)
      .offset(offset)
      .execute()
  }

  async getStocksByEntityAndMaterials(
    c: Context,
    entityId: number,
    materialIds: number[]
  ) {
    const latestStocks = await c.var.trx
      .selectFrom("ws_stocks as ws")
      .select(["ws.material_id", "ws.qty as total_qty", "ws.id"])
      .where("ws.entity_id", "=", entityId)
      .where("ws.material_id", "in", materialIds)
      .where("ws.deleted_at", "is", null)
      .orderBy("ws.id", "desc")
      .execute()

    const latestByMaterial = new Map<
      number,
      { material_id: number | null; total_qty: number }
    >()

    for (const stock of latestStocks) {
      if (
        stock.material_id !== null &&
        !latestByMaterial.has(stock.material_id)
      ) {
        latestByMaterial.set(stock.material_id, {
          material_id: stock.material_id,
          total_qty: Number(stock.total_qty),
        })
      }
    }

    return Array.from(latestByMaterial.values())
  }
}
