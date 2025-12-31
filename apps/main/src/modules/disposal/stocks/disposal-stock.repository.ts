import { KFA_LEVEL_ID } from "@/common/constants/material.js"
import { Context } from "hono"
import { sql } from "kysely"
import { BaseRepository } from "../../base.repository.js"
import { GetDisposalStocksQueries } from "./disposal-stock.schema.js"

export class DisposalStockRepository extends BaseRepository<"ws_disposal_stocks"> {
  constructor() {
    super("ws_disposal_stocks", false, true)
  }

  baseQueryList(
    c: Context,
    params: GetDisposalStocksQueries,
    isHierarchy: boolean
  ) {
    return c.var.trx
      .selectFrom("ws_disposal_stocks as ds")
      .innerJoin("ws_stocks as s", "s.id", "ds.stock_id")
      .innerJoin("ws_entities as e", "e.id", "s.entity_id")
      .innerJoin("ws_activities as a", "a.id", "s.activity_id")
      .leftJoin("ws_batches as b", "s.batch_id", "b.id")
      .innerJoin(
        "ws_materials as m",
        "m.id",
        isHierarchy ? "s.parent_material_id" : "s.material_id"
      )
      .where("a.program_id", "=", c.var.programId)
      .where("m.deleted_at", "is", null)
      .where("e.deleted_at", "is", null)
      .$if(!!params.entity_id, (qb) =>
        qb.where("s.entity_id", "=", params.entity_id ?? 0)
      )
      .$if(!!params.entity_tag_id, (qb) =>
        qb.where("e.entity_tag_id", "=", params.entity_tag_id ?? 0)
      )
      .$if(!!params.province_id, (qb) =>
        qb.where("e.province_id", "=", params.province_id ?? 0)
      )
      .$if(!!params.regency_id, (qb) =>
        qb.where("e.regency_id", "=", params.regency_id ?? 0)
      )
      .$if(!!params.material_id && params.material_id.length > 0, (qb) =>
        qb
          .$if(isHierarchy, (qb) =>
            qb.where("s.parent_material_id", "in", params.material_id ?? [-1])
          )
          .$if(!isHierarchy, (qb) =>
            qb.where("s.material_id", "in", params.material_id ?? [-1])
          )
      )
      .$if(!!params.material_level_id, (qb) =>
        qb.where("m.material_level_id", "=", params.material_level_id ?? 0)
      )
      .$if(!!params.batch_ids && params.batch_ids.length > 0, (qb) =>
        qb.where("s.batch_id", "in", params.batch_ids ?? [-1])
      )
      .$if(!!params.activity_id, (qb) =>
        qb.where("s.activity_id", "=", params.activity_id ?? 0)
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
      .$if(params.only_have_qty === 1, (qb) =>
        qb.where((eb) =>
          eb.or([
            eb("ds.disposal_discard_qty", ">", 0),
            eb("ds.disposal_received_qty", ">", 0),
          ])
        )
      )
      .$if(!!params.expired_from && !!params.expired_to, (qb) =>
        qb.where((eb) =>
          eb.and([
            eb("b.expired_date", ">=", `${params.expired_from} 00:00:00`),
            eb("b.expired_date", "<=", `${params.expired_to} 23:59:59`),
          ])
        )
      )
      .$if(!!params.material_type_id, (qb) =>
        qb.where("m.material_type_id", "=", params.material_type_id ?? 0)
      )
  }

  async findAll(c: Context, params: GetDisposalStocksQueries) {
    // Query disposal stock joined with stock and related tables
    const isHierarchy =
      (c.var.config?.material.is_hierarchy_enabled &&
        params.material_level_id !== KFA_LEVEL_ID.VARIANT) ??
      false

    const page = params.page ?? 1
    const paginate = params.paginate ?? 10
    const offset = (page - 1) * paginate

    // Base query builder (tanpa SELECT)
    const baseQuery = this.baseQueryList(c, params, isHierarchy)

    // Final query for data (with SELECT, GROUP BY, LIMIT, OFFSET)
    const dataQuery = baseQuery
      .select([
        "s.entity_id",
        "e.name as entity_name",
        "m.name as material_name",
        "m.code as material_code",
        "s.parent_material_id as parent_material_id",
        sql`sum(ds.disposal_qty)`.as("total_disposal_qty"),
        sql`sum(ds.disposal_discard_qty)`.as("total_disposal_discard_qty"),
        sql`sum(ds.disposal_received_qty)`.as("total_disposal_received_qty"),
        sql`sum(ds.disposal_shipped_qty)`.as("total_disposal_shipped_qty"),
        sql`max(ds.updated_at)`.as("stock_update"),
        sql`max(ds.updated_at)`.as("updated_at"),
      ])
      .$if(!isHierarchy, (qb) => qb.select("s.material_id as f_material_id"))
      .$if(isHierarchy, (qb) =>
        qb.select("s.parent_material_id as f_material_id")
      )
      .orderBy("m.name asc")
      .groupBy(["s.entity_id", "f_material_id", "m.name"])
      .limit(paginate)
      .offset(offset)

    // Query to count total groups (distinct group by keys)
    const countQuery = baseQuery
      .clearSelect()
      .clearOrderBy()
      .select([
        sql`COUNT(DISTINCT CONCAT(s.entity_id, '-', ${isHierarchy ? sql`s.parent_material_id` : sql`s.material_id`}, '-', m.name))`.as(
          "total"
        ),
      ])

    const [data, totalResult] = await Promise.all([
      dataQuery.execute(),
      countQuery.executeTakeFirst(),
    ])

    const total = Number(totalResult?.total) || 0

    return {
      data,
      total,
    }
  }

  async findDetails(c: Context, params: GetDisposalStocksQueries) {
    const query = c.var.trx
      .selectFrom("ws_disposal_stocks as ds")
      .innerJoin("ws_stocks as s", "s.id", "ds.stock_id")
      .innerJoin("ws_materials as m", "m.id", "s.material_id")
      .innerJoin("ws_entities as e", "e.id", "s.entity_id")
      .innerJoin("ws_activities as a", "a.id", "s.activity_id")
      .innerJoin(
        "ws_transaction_reasons as tr",
        "tr.id",
        "ds.transaction_reason_id"
      )
      .leftJoin("ws_batches as b", "s.batch_id", "b.id")
      .leftJoin("ws_manufactures as mn", "mn.id", "b.manufacture_id")
      .where("m.deleted_at", "is", null)
      .where("e.deleted_at", "is", null)
      .where("a.program_id", "=", c.var.programId)
      .$if(!!params.entity_id, (qb) =>
        qb.where("s.entity_id", "=", params.entity_id ?? 0)
      )
      .$if(!!params.province_id, (qb) =>
        qb.where("e.province_id", "=", params.province_id ?? 0)
      )
      .$if(!!params.regency_id, (qb) =>
        qb.where("e.regency_id", "=", params.regency_id ?? 0)
      )
      .$if(!!params.material_id && params.material_id.length > 0, (qb) =>
        qb.where("s.material_id", "in", params.material_id ?? [-1])
      )
      .$if(!!params.batch_ids && params.batch_ids.length > 0, (qb) =>
        qb.where("s.batch_id", "in", params.batch_ids ?? [-1])
      )
      .$if(!!params.activity_id, (qb) =>
        qb.where("s.activity_id", "=", params.activity_id ?? 0)
      )
      .$if(!!params.parent_material_id, (qb) =>
        qb.where("s.parent_material_id", "=", params.parent_material_id ?? 0)
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
      .select([
        "ds.id as disposal_stock_id",
        "s.id as stock_id",
        "s.entity_id",
        "s.batch_id",
        "e.name as entity_name",
        "m.id as material_id",
        "m.name as material_name",
        "m.code as material_code",
        "s.parent_material_id as parent_material_id",
        "s.activity_id as activity_id",
        "ds.transaction_reason_id as transaction_reason_id",
        "ds.disposal_qty as disposal_qty",
        "ds.disposal_discard_qty",
        "ds.disposal_received_qty",
        "ds.disposal_shipped_qty",
        "ds.updated_at",
        sql`if(b.id is null, null, json_object(
          'id', b.id,
          'code', b.code,
          'production_date', b.production_date,
          'expired_date', b.expired_date,
          'manufacture', json_object(
            'id', mn.id,
            'name', mn.name,
            'address', mn.address
          )
        ))`.as("batch"),
        sql`if(a.id is null, null, json_object(
          'id', a.id,
          'name', a.name,
          'code', a.code
        ))`.as("activity"),
        sql`if(tr.id is null, null, json_object(
          'id', tr.id,
          'title', tr.title,
          'title_en', tr.title_en
        ))`.as("transaction_reason"),
      ])
      .orderBy(["e.name", "m.name"])

    const data = await query.execute()

    return data
  }

  async getStreamData(c: Context, params: GetDisposalStocksQueries) {
    const isHierarchy =
      (c.var.config?.material.is_hierarchy_enabled &&
        params.material_level_id !== KFA_LEVEL_ID.VARIANT) ??
      false

    const baseQuery = this.baseQueryList(c, params, isHierarchy)

    return baseQuery
      .leftJoin(
        "ws_transaction_reasons as tr",
        "tr.id",
        "ds.transaction_reason_id"
      )
      .leftJoin("entity_types as et", "et.id", "e.type")
      .leftJoin("locations as prov", "prov.id", "e.province_id")
      .leftJoin("locations as reg", "reg.id", "e.regency_id")
      .leftJoin("locations as sub", "sub.id", "e.sub_district_id")
      .leftJoin("ws_budget_sources as bs", "bs.id", "s.budget_source_id")
      .leftJoin("ws_materials as mc", "mc.id", "s.material_id")
      .select([
        "e.id",
        "e.name as entity",
        "prov.name as province",
        "reg.name as regency",
        "sub.name as subdistrict",
        "et.name as entity_type",
        "m.name as material",
        "m.code as material_code",
        "mc.name as material_child",
        "b.code as batch_code",
        "b.expired_date",
        "a.name as activity",
        "ds.disposal_qty",
        "ds.disposal_discard_qty",
        "ds.disposal_received_qty",
        "ds.disposal_shipped_qty",
        "tr.title as transaction_reason",
        "bs.name as budget_source",
        "ds.updated_at",
      ])
      .orderBy("m.name asc")
      .groupBy(["s.entity_id", "b.code", "m.name", "tr.title"])
      .stream()
  }

  async getHistoryDisposal(
    c: Context,
    params: { materialIds: number[]; entityIds: number[] }
  ) {
    const queryHistoryDisposal = c.var.trx
      .selectFrom("ws_disposal_transactions as dt")
      .innerJoin("ws_activities as a", "a.id", "dt.activity_id")
      .where("a.program_id", "=", c.var.programId)
      .where("dt.material_id", "in", params.materialIds)
      .where("dt.entity_id", "in", params.entityIds)
      .groupBy(
        "dt.disposal_transaction_type_id",
        "dt.material_id",
        "dt.entity_id"
      )
      .select([
        "dt.disposal_transaction_type_id",
        "dt.material_id",
        "dt.entity_id",
        ({ fn }) => fn.countAll().as("total"),
      ])

    const data = await queryHistoryDisposal.execute()
    return data
  }
}
