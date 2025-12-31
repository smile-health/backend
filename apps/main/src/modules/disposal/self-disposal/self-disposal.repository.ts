import { BaseRepository } from "@/modules/base.repository.js"
import { Context } from "hono"
import { SelfDisposalListPaginatedRequestDTO } from "./self-disposal.schema.js"
import { sql } from "kysely"
import { associate } from "@smile/lib/utils.js"
import moment from "moment"

interface DisposalStockData {
  stock_id: number
  transaction_reason_id: number
  disposal_discard_qty: number
  disposal_received_qty: number
  disposal_qty: number
  disposal_shipped_qty: number
}

interface DisposalTransactionData {
  disposal_transaction_type_id: number
  disposal_method_id: number
  entity_id: number
  report_number?: string
  comment?: string
  activity_id: number
  material_id: number
  stock_disposal_id: number
  opening_qty: number
  change_qty: number
  disposal_discard_qty: number
  disposal_received_qty: number
  open_vial: number
}

export class SelfDisposalRepository extends BaseRepository<"ws_disposal_transactions"> {
  constructor() {
    super("ws_disposal_transactions", true)
  }

  async findAll(c: Context, params: SelfDisposalListPaginatedRequestDTO) {
    const page = params.page ?? 1
    const paginate = params.paginate ?? 10
    const offset = (page - 1) * paginate

    const startDate = moment(params.start_date).format("YYYY-MM-DD 00:00:00")
    const endDate = moment(params.end_date).format("YYYY-MM-DD 23:59:59")

    const query = c.var.trx
      .selectFrom("ws_disposal_transactions as dt")
      .innerJoin("ws_disposal_stocks as ds", "ds.id", "dt.stock_disposal_id")
      .innerJoin("ws_stocks as s", "s.id", "ds.stock_id")
      .innerJoin("ws_entities as e", "e.id", "dt.entity_id")
      .innerJoin("ws_activities as a", "a.id", "dt.activity_id")
      .innerJoin("ws_materials as m", "m.id", "s.material_id")
      .innerJoin(
        "ws_disposal_transaction_types as dtt",
        "dtt.id",
        "dt.disposal_transaction_type_id"
      )
      .innerJoin("ws_disposal_methods as dm", "dm.id", "dt.disposal_method_id")
      .leftJoin(
        "ws_transaction_reasons as tr",
        "ds.transaction_reason_id",
        "tr.id"
      )
      .where("a.program_id", "=", c.var.programId)
      .where("m.deleted_at", "is", null)
      .where("e.deleted_at", "is", null)
      .where("dt.deleted_at", "is", null)
      .where("ds.deleted_at", "is", null)
      .$if(!!params.start_date && !!params.end_date, (qb) =>
        qb.where((eb) =>
          eb.and([
            eb("dt.created_at", ">=", sql<Date>`${startDate}`),
            eb("dt.created_at", "<=", sql<Date>`${endDate}`),
          ])
        )
      )
      .$if(!!params.material_id && params.material_id.length > 0, (qb) =>
        qb.where("m.id", "in", params.material_id ?? [-1])
      )
      .$if(!!params.material_type_id, (qb) =>
        qb.where("m.material_type_id", "=", params.material_type_id ?? 0)
      )
      .$if(!!params.material_level_id, (qb) =>
        qb.where("m.material_level_id", "=", params.material_level_id ?? 0)
      )
      .$if(!!params.activity_id, (qb) =>
        qb.where("dt.activity_id", "=", params.activity_id ?? 0)
      )
      .$if(!!params.province_id, (qb) =>
        qb.where("e.province_id", "=", String(params.province_id))
      )
      .$if(!!params.regency_id, (qb) =>
        qb.where("e.regency_id", "=", String(params.regency_id))
      )
      .$if(!!params.entity_id, (qb) =>
        qb.where("dt.entity_id", "=", params.entity_id ?? 0)
      )
      .$if(!!params.entity_tag_id, (qb) =>
        qb.where("e.entity_tag_id", "=", params.entity_tag_id ?? 0)
      )
      .$if(!!params.disposal_transaction_type_id, (qb) =>
        qb.where(
          "dt.disposal_transaction_type_id",
          "=",
          params.disposal_transaction_type_id ?? 0
        )
      )
      .$if(!!params.disposal_method_id, (qb) =>
        qb.where("dt.disposal_method_id", "=", params.disposal_method_id ?? 0)
      )
      .$if(!!params.transaction_reason_id, (qb) =>
        qb.where("tr.id", "=", params.transaction_reason_id ?? 0)
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

    const [data, total] = await Promise.all([
      query
        .select([
          "dt.id",
          "s.entity_id",
          "e.name as entity_name",
          "m.name as material_name",
          "m.code as material_code",
          "m.id as material_id",
          "tr.id as transaction_reason_id",
          "tr.title as transaction_reason_title",
          "dt.stock_disposal_id as stock_disposal_id",
          "dt.disposal_transaction_type_id as disposal_transaction_type_id",
          "dt.disposal_method_id as disposal_method_id",
          "dt.activity_id as activity_id",
          "dt.opening_qty as opening_qty",
          "dt.change_qty as change_qty",
          "dt.disposal_discard_qty as disposal_discard_qty",
          "dt.disposal_received_qty as disposal_received_qty",
          "dt.updated_at as updated_at",
          "dt.updated_by as updated_by",
          "dt.created_at as created_at",
          "dt.created_by as created_by",
          "dt.report_number as report_number",
          "dt.comment as comment",
          sql`(dt.opening_qty + dt.change_qty)`.as("closing_qty"),
          sql`if(dtt.id is null, null, json_object(
          'id', dtt.id,
          'title', dtt.title
        ))`.as("disposal_transaction_type"),
          sql`if(dm.id is null, null, json_object(
          'id', dm.id,
          'title', dm.title
        ))`.as("disposal_method"),
          "dm.title as disposal_method_title",
        ])
        .orderBy("dt.created_at", "desc")
        .limit(paginate)
        .offset(offset)
        .execute(),
      query
        .select((eb) => eb.fn.count("dt.id").distinct().as("total"))
        .executeTakeFirstOrThrow(),
    ])

    const totalResult = Number(total?.total) || 0

    return {
      data,
      total: totalResult,
    }
  }

  async getStreamData(c: Context, params: SelfDisposalListPaginatedRequestDTO) {
    const startDate = moment(params.start_date).format("YYYY-MM-DD 00:00:00")
    const endDate = moment(params.end_date).format("YYYY-MM-DD 23:59:59")

    return c.var.trx
      .selectFrom("ws_disposal_transactions as dt")
      .innerJoin("ws_disposal_stocks as ds", "ds.id", "dt.stock_disposal_id")
      .innerJoin("ws_stocks as s", "s.id", "ds.stock_id")
      .innerJoin("ws_entities as e", "e.id", "dt.entity_id")
      .leftJoin("entity_types as et", "et.id", "e.type")
      .leftJoin("locations as prov", "prov.id", "e.province_id")
      .leftJoin("locations as reg", "reg.id", "e.regency_id")
      .leftJoin("locations as sub", "sub.id", "e.sub_district_id")
      .leftJoin("ws_batches as b", "s.batch_id", "b.id")
      .leftJoin("ws_manufactures as mn", "mn.id", "b.manufacture_id")
      .innerJoin("ws_activities as a", "a.id", "dt.activity_id")
      .innerJoin("ws_materials as m", "m.id", "dt.material_id")
      .leftJoin("ws_activities as sa", "sa.id", "s.activity_id")
      .innerJoin(
        "ws_disposal_transaction_types as dtt",
        "dtt.id",
        "dt.disposal_transaction_type_id"
      )
      .leftJoin("ws_disposal_methods as dm", "dm.id", "dt.disposal_method_id")
      .leftJoin(
        "ws_transaction_reasons as tr",
        "ds.transaction_reason_id",
        "tr.id"
      )
      .leftJoin("ws_users as uc", "dt.created_by", "uc.id")
      .leftJoin("ws_users as up", "dt.updated_by", "up.id")
      .where("a.program_id", "=", c.var.programId)
      .where("m.deleted_at", "is", null)
      .where("e.deleted_at", "is", null)
      .where("dt.deleted_at", "is", null)
      .where("ds.deleted_at", "is", null)
      .$if(!!params.start_date && !!params.end_date, (qb) =>
        qb.where((eb) =>
          eb.and([
            eb("dt.created_at", ">=", sql<Date>`${startDate}`),
            eb("dt.created_at", "<=", sql<Date>`${endDate}`),
          ])
        )
      )
      .$if(!!params.material_id && params.material_id.length > 0, (qb) =>
        qb.where("m.id", "in", params.material_id ?? [-1])
      )
      .$if(!!params.material_type_id, (qb) =>
        qb.where("m.material_type_id", "=", params.material_type_id ?? 0)
      )
      .$if(!!params.material_level_id, (qb) =>
        qb.where("m.material_level_id", "=", params.material_level_id ?? 0)
      )
      .$if(!!params.activity_id, (qb) =>
        qb.where("dt.activity_id", "=", params.activity_id ?? 0)
      )
      .$if(!!params.province_id, (qb) =>
        qb.where("e.province_id", "=", String(params.province_id))
      )
      .$if(!!params.regency_id, (qb) =>
        qb.where("e.regency_id", "=", String(params.regency_id))
      )
      .$if(!!params.entity_id, (qb) =>
        qb.where("dt.entity_id", "=", params.entity_id ?? 0)
      )
      .$if(!!params.entity_tag_id, (qb) =>
        qb.where("e.entity_tag_id", "=", params.entity_tag_id ?? 0)
      )
      .$if(!!params.disposal_transaction_type_id, (qb) =>
        qb.where(
          "dt.disposal_transaction_type_id",
          "=",
          params.disposal_transaction_type_id ?? 0
        )
      )
      .$if(!!params.disposal_method_id, (qb) =>
        qb.where("dt.disposal_method_id", "=", params.disposal_method_id ?? 0)
      )
      .$if(!!params.transaction_reason_id, (qb) =>
        qb.where("tr.id", "=", params.transaction_reason_id ?? 0)
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
        "e.id as entity_id",
        "e.name as entity",
        "prov.name as province",
        "reg.name as regency",
        "sub.name as subdistrict",
        "et.name as entity_tag",
        "m.id as material_id",
        "m.name as material",
        "m.code as material_code",
        "b.code as batch_code",
        "b.expired_date as expired_date",
        "mn.name as manufacture_name",
        "tr.title as transaction_reason",
        "a.name as activity",
        "dt.opening_qty",
        "dt.change_qty",
        sql`(dt.opening_qty + dt.change_qty)`.as("closing_qty"),
        "sa.name as stock_activity",
        "dm.title as disposal_method_title",
        "dt.report_number",
        sql`uc.firstname || ' ' || uc.lastname`.as("user_created_fullname"),
        "dt.created_at",
        "dt.updated_at",
        sql`up.firstname || ' ' ||  up.lastname`.as("user_updated_fullname"),
      ])
      .orderBy("dt.created_at", "desc")
      .stream()
  }

  async findEntityByCode(c: Context, code: string) {
    return c.var.trx
      .selectFrom("ws_entities")
      .selectAll()
      .where("code", "=", code)
      .executeTakeFirst()
  }

  async findEntityById(c: Context, id: number) {
    return c.var.trx
      .selectFrom("ws_entities")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst()
  }

  async findDisposalStockById(c: Context, id: number) {
    return c.var.trx
      .selectFrom("ws_disposal_stocks")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst()
  }

  async getBasicDetailMapped(c: Context, disposalStockIds: number[]) {
    const disposal_stocks = await c.var.trx
      .selectFrom("ws_disposal_stocks as ds")
      .innerJoin("ws_stocks as s", "s.id", "ds.stock_id")
      .innerJoin(
        "ws_transaction_reasons as tr",
        "tr.id",
        "ds.transaction_reason_id"
      )
      .innerJoin("ws_activities as a", "a.id", "s.activity_id")
      .leftJoin("ws_batches as b", "s.batch_id", "b.id")
      .leftJoin("ws_manufactures as mn", "mn.id", "b.manufacture_id")
      .where("ds.deleted_at", "is", null)
      .where("s.deleted_at", "is", null)
      .where("ds.id", "in", disposalStockIds)
      .select([
        "ds.id as id",
        "s.id as stock_id",
        "s.entity_id",
        "s.batch_id",
        "s.material_id as material_id",
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
      .execute()

    // console.log("disposal_stocks", disposal_stocks.length)
    // console.log("associate disposal_stocks", associate(disposal_stocks, "id"))
    return associate(disposal_stocks, "id")
  }

  async findDisposalStockByStockId(c: Context, stockId: number) {
    return c.var.trx
      .selectFrom("ws_disposal_stocks")
      .selectAll()
      .where("stock_id", "=", stockId)
      .executeTakeFirst()
  }

  async findDisposalStockByIdAndTransactionReason(
    c: Context,
    id: number,
    transactionReasonId: number
  ) {
    return c.var.trx
      .selectFrom("ws_disposal_stocks")
      .leftJoin("ws_stocks", "ws_disposal_stocks.stock_id", "ws_stocks.id")
      .select([
        "ws_disposal_stocks.id",
        "ws_disposal_stocks.disposal_discard_qty",
        "ws_disposal_stocks.disposal_received_qty",
        "ws_disposal_stocks.disposal_shipped_qty",
        "ws_disposal_stocks.disposal_qty",
        "ws_stocks.material_id",
      ])
      .where("ws_disposal_stocks.id", "=", id)
      .where(
        "ws_disposal_stocks.transaction_reason_id",
        "=",
        transactionReasonId
      )
      .executeTakeFirst()
  }

  async updateStockQuantities(
    c: Context,
    id: number,
    quantities: {
      discard_qty: number
      received_qty: number
      disposal_qty: number
    }
  ) {
    return c.var.trx
      .updateTable("ws_disposal_stocks")
      .set({
        disposal_discard_qty: quantities.discard_qty,
        disposal_received_qty: quantities.received_qty,
        disposal_qty: sql`disposal_qty + ${quantities.disposal_qty}`,
        updated_at: new Date(),
        updated_by: c.var.userId,
      })
      .where("id", "=", id)
      .execute()
  }

  async ensureEntityMaterial(c: Context, materialId: number, entityId: number) {
    const existing = await this.findEntityMasterMaterial(
      c,
      materialId,
      entityId
    )
    return existing
  }

  async findEntityMasterMaterial(
    c: Context,
    materialId: number,
    entityId: number
  ) {
    return c.var.trx
      .selectFrom("ws_entity_material_activities")
      .selectAll()
      .where("material_id", "=", materialId)
      .where("entity_id", "=", entityId)
      .executeTakeFirst()
  }

  async createExterminationTransaction(
    c: Context,
    data: DisposalTransactionData
  ) {
    return c.var.trx
      .insertInto("ws_disposal_transactions")
      .values(data)
      .executeTakeFirst()
  }

  async createDisposalStock(c: Context, data: DisposalStockData) {
    const result = await c.var.trx
      .insertInto("ws_disposal_stocks")
      .values({
        stock_id: data.stock_id,
        transaction_reason_id: data.transaction_reason_id,
        disposal_discard_qty: Number(data.disposal_discard_qty) || 0,
        disposal_received_qty: Number(data.disposal_received_qty) || 0,
        created_by: c.var.userId,
        updated_by: c.var.userId,
        created_at: new Date(),
        updated_at: new Date(),
      })
      .executeTakeFirst()

    return { insertId: result.insertId }
  }

  async updateDisposalStock(
    c: Context,
    id: number,
    data: Partial<DisposalStockData>
  ) {
    const result = await c.var.trx
      .updateTable("ws_disposal_stocks")
      .set({
        disposal_discard_qty: Number(data.disposal_discard_qty) || 0,
        disposal_received_qty: Number(data.disposal_received_qty) || 0,
        disposal_qty: Number(data.disposal_qty) || 0,
        updated_by: c.var.userId,
        updated_at: new Date(),
      })
      .where("id", "=", id)
      .executeTakeFirst()

    return result
  }

  async createDisposalTransaction(c: Context, data: DisposalTransactionData) {
    const result = await c.var.trx
      .insertInto("ws_disposal_transactions")
      .values({
        disposal_transaction_type_id: data.disposal_transaction_type_id,
        disposal_method_id: data.disposal_method_id,
        entity_id: data.entity_id,
        activity_id: data.activity_id,
        material_id: data.material_id,
        stock_disposal_id: data.stock_disposal_id,
        opening_qty: data.opening_qty,
        change_qty: data.change_qty,
        disposal_discard_qty: data.disposal_discard_qty,
        disposal_received_qty: data.disposal_received_qty,
        open_vial: data.open_vial,
        report_number: data.report_number, // Added
        comment: data.comment, // Added
        created_by: c.var.userId,
        updated_by: c.var.userId,
        created_at: new Date(),
        updated_at: new Date(),
      })
      .executeTakeFirst()

    return { insertId: result.insertId }
  }

  async findDisposalTransactionById(c: Context, id: number) {
    return c.var.trx
      .selectFrom("ws_disposal_transactions")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst()
  }
}
