import { DB } from "@/common/infrastructure/database/types/db.js"
import { Context } from "@smile/lib/types/context.js"
import { type z } from "zod"
import { GetStockOpnamesQueries } from "./integration.schema.js"
import {
  Insertable,
  sql,
  SelectQueryBuilder,
  Nullable,
  InsertResult,
} from "kysely"
import {
  WsStockOpnames,
  WsMaterials,
  WsEntities,
  WsStocks,
  WsBatches,
  Materials,
} from "@/common/infrastructure/database/types/db.js"

type StockOpnamesQueries = z.infer<typeof GetStockOpnamesQueries>

export class IntegrationRepository {
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
    params: any
  ) {
    const {
      month_period,
      year_period,
      entity_id,
      entity_tag_id,
      province_id,
      regency_id,
      created_from,
      created_to,
      id_satu_sehat,
      program_id,
    } = params

    query = query.where("wa.program_id", "=", program_id)

    if (month_period) {
      query = query.where("wssop.month_period", "=", month_period)
    }

    if (year_period) {
      query = query.where("wssop.year_period", "=", year_period)
    }

    if (entity_id) {
      query = query.where("wsso.entity_id", "=", entity_id)
    }

    if (entity_tag_id) {
      query = query.where((eb) => eb("wse.entity_tag_id", "=", entity_tag_id!))
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

    if (id_satu_sehat) {
      query = query.where("wse.id_satu_sehat", "=", id_satu_sehat)
    }

    // if (material_id) {
    //   query = query.where("wsso.material_id", "=", material_id)
    // }

    // if (parent_material_id) {
    //   query = query.where("wsso.parent_material_id", "=", parent_material_id)
    // }

    // if (material_type_id) {
    //   query = query.where((eb) =>
    //     eb("wsm.material_type_id", "=", material_type_id!)
    //   )
    // }

    // if (activity_id) {
    //   query = query.where("wsso.activity_id", "=", activity_id)
    // }

    // if (stock_id) {
    //   query = query.where("wsso.stock_id", "=", stock_id)
    // }

    // if (batch_code) {
    //   query = query.where("wsso.batch_code", "like", `%${batch_code}%`)
    // }

    // if (expired_start_date) {
    //   query = query.where((eb) =>
    //     eb("wsb.expired_date", ">=", expired_start_date!)
    //   )
    // }

    // if (expired_end_date) {
    //   query = query.where((eb) =>
    //     eb("wsb.expired_date", "<=", expired_end_date!)
    //   )
    // }

    // if (only_have_qty === 1) {
    //   query = query.where((eb) =>
    //     eb.or([
    //       eb("wsso.recorded_qty", ">", 0),
    //       eb("wsso.in_transit_qty", ">", 0),
    //       eb("wsso.actual_qty", ">", 0),
    //     ])
    //   )
    // } else if (only_have_qty === 0) {
    //   query = query.where((eb) =>
    //     eb.and([
    //       eb("wsso.recorded_qty", "=", 0),
    //       eb("wsso.in_transit_qty", "=", 0),
    //       eb("wsso.actual_qty", "=", 0),
    //     ])
    //   )
    // }

    // if (is_within_period) {
    //   query = query.where("wsso.is_within_period", "=", is_within_period)
    // }

    return query
  }
  /**
   * Find all stock opnames with pagination and filtering.
   */
  async findAll(c: Context<DB>, params: any) {
    let query: any = c.var.trx
      .selectFrom(`ws_stock_opnames as wsso`)
      .innerJoin("material_workspaces as mw", "mw.id", "wsso.material_id")
      .innerJoin(
        "material_workspaces as mwp",
        "mwp.id",
        "wsso.parent_material_id"
      )
      .innerJoin("materials as wsm", "wsm.id", "mw.material_id")
      .leftJoin("ws_entities as wse", "wse.id", "wsso.entity_id")
      .leftJoin("ws_stocks as wss", "wss.id", "wsso.stock_id")
      .leftJoin("ws_batches as wsb", "wsb.id", "wss.batch_id")
      .leftJoin("material_units as mu", "mu.id", "wsm.unit_of_consumption_id")
      .leftJoin("ws_stock_opname_periods as wssop", (join) =>
        join
          .onRef("wssop.id", "=", "wsso.period_id")
          .on("wssop.deleted_at", "is", null)
      )
      .leftJoin("entity_tags as tag", "tag.id", "wse.entity_tag_id")
      .leftJoin("locations as prov", "prov.id", "wse.province_id")
      .leftJoin("locations as reg", "reg.id", "wse.regency_id")

      .leftJoin("materials as wsmp", "wsmp.id", "mwp.material_id")
      .leftJoin(
        "material_units as mup",
        "mup.id",
        "wsmp.unit_of_consumption_id"
      )
      .leftJoin("ws_activities as wa", "wsso.activity_id", "wa.id")
      .leftJoin("workspaces as w_program", "wa.program_id", "w_program.id")
      .where("wsso.deleted_at", "is", null)
    // .where("wa.program_id", "=", 9)

    query = this.#conditionStockOpnameWhereClause(query, params)

    const countQuery = query.select((eb) => eb.fn.countAll().as("total"))
    const dataQuery = query
      .select([
        "wsso.id",
        "wsso.recorded_qty",
        "wsso.actual_qty",
        "wsso.in_transit_qty",
        "wsso.created_at",
        "wsso.updated_at",
        sql<{
          id: number
          name: string
        }>`JSON_OBJECT(
            'id', w_program.id,
            'name', w_program.name
          )`.as("program"),
        // "wsso.is_within_period",

        // "wse.regency_id",
        // "wse.province_id",
        // "wse.entity_tag_id",

        sql<{
          id: number
          name: string

          address: string | null
          tag: string | null
          id_satu_sehat: number | null

          location: string | null
        }>`JSON_OBJECT(
            'id', wse.id,
            'name', wse.name,
            
            'address', wse.address,
            'tag', tag.title,
            'id_satu_sehat', wse.id_satu_sehat,
            'location', CONCAT_WS(', ', prov.name, reg.name)
          )`.as("entity"),

        sql<{
          id: number
          name: string
          unit_of_consumption: string | null
          kfa_code: string | null
        }>`JSON_OBJECT(
            'id', wsso.material_id,
            'name', wsm.name,
            'unit_of_consumption', mu.name,
            'kfa_code', wsm.code
          )`.as("material"),
        sql<{
          id: number
          name: string
          kfa_code: string | null
        }>`JSON_OBJECT(
            'id', wsso.parent_material_id,
            'name', wsmp.name,
            'kfa_code', wsmp.code
          )`.as("parent_material"),
        sql<{
          code: string | null
          expired_date: Date | null
        }>`JSON_OBJECT(
            'code', wsso.batch_code,
            'expired_date', wsso.expired_date
          )`.as("batch"),
        sql<{
          id: number
          name: string
        }>`JSON_OBJECT(
            'id', wssop.id,
            'name', CONCAT(MONTHNAME(
                      CONCAT(wssop.year_period,'-',wssop.month_period,'-','1')
                      ), ' ', wssop.year_period)
          )`.as("period"),
      ])
      .offset((params.page - 1) * params.paginate)
      .limit(params.paginate)
      .orderBy("wsso.updated_at", "desc")

    const [countResult, data] = await Promise.all([
      countQuery.executeTakeFirst(),
      dataQuery.execute(),
    ])

    return {
      page: params.page,
      item_per_page: params.paginate,
      total_item: Number(countResult?.total ?? 0),
      total_page: Math.ceil(
        (Number(countResult?.total ?? 0) || 0) / params.paginate
      ),
      list_pagination: [10, 25, 50, 100],
      data,
      // total: Number(countResult?.total ?? 0),
    }
  }

  /**
   * Find all transactions with pagination and filtering.
   */

  #conditionTransactionWhereClause(
    query: SelectQueryBuilder<DB, any, object>,
    params: any
  ) {
    const {
      entity_id,
      material_id,
      province_id,
      regency_id,
      start_date,
      end_date,
      program_id,
      entity_tag_id,
      kfa_code,
      id_satu_sehat,
    } = params

    query = query.where("wa.program_id", "=", program_id)
    query = query.where("wt.transaction_type_id", "in", [2, 3]) // only stock in and out
    if (entity_id) {
      query = query.where("we.id", "=", entity_id)
    }

    if (material_id) {
      query = query.where("wm.id", "=", material_id)
    }

    if (start_date) {
      query = query.where("wt.created_at", ">=", start_date)
    }

    if (end_date) {
      query = query.where("wt.created_at", "<=", end_date)
    }

    if (province_id) {
      query = query.where("l_province.id", "=", province_id)
    }

    if (regency_id) {
      query = query.where("l_regency.id", "=", regency_id)
    }

    if (entity_tag_id) {
      query = query.where("et.id", "=", entity_tag_id)
    }

    if (kfa_code) {
      query = query.where("wm.hierarchy_code", "=", kfa_code)
    }

    if (id_satu_sehat) {
      query = query.where("we.id_satu_sehat", "=", id_satu_sehat)
    }

    return query
  }

  async findAllTransactions(c: Context<DB>, params: any) {
    let query: any = c.var.trx
      .selectFrom("ws_transactions as wt")
      .leftJoin("ws_entities as we", "wt.entity_id", "we.id")
      .leftJoin("entity_tags as et", "we.entity_tag_id", "et.id")
      .leftJoin("ws_activities as wa", "wt.activity_id", "wa.id")
      .leftJoin("workspaces as w_program", "wa.program_id", "w_program.id")
      .leftJoin("locations as l_province", "we.province_id", "l_province.id")
      .leftJoin("locations as l_regency", "we.regency_id", "l_regency.id")
      .leftJoin("ws_stocks as ws", "wt.stock_id", "ws.id")
      .leftJoin("ws_materials as wm", "ws.material_id", "wm.id")
      .leftJoin("ws_materials as wmp", "wm.parent_id", "wmp.id")
      .leftJoin("material_types as mt", "wm.material_type_id", "mt.id")
      .leftJoin(
        "ws_transaction_types as wtt",
        "wt.transaction_type_id",
        "wtt.id"
      )

      .leftJoin("ws_orders as wo", "wt.order_id", "wo.id")
      .leftJoin(
        "ws_entities as wo_customer",
        "wo.customer_id",
        "wo_customer.id"
      )
      .leftJoin("ws_entities as wo_vendor", "wo.vendor_id", "wo_vendor.id")

      .leftJoin("ws_purchases as wpc", (join) =>
        join
          .onRef("wt.id", "=", "wpc.source_id")
          .on(sql`wpc.source_type = 'transaction'`)
      )
      .leftJoin("ws_budget_sources as wbs", "wpc.budget_source_id", "wbs.id")
      .leftJoin("ws_activities as was", "ws.activity_id", "was.id")
      .leftJoin("ws_batches as wb", "ws.batch_id", "wb.id")
      .leftJoin("ws_manufactures as wmf", "wb.manufacture_id", "wmf.id")
      .leftJoin("material_units as mu", "mu.id", "wm.unit_of_consumption_id")
    // .where("wa.program_id", "=", 9)

    query = this.#conditionTransactionWhereClause(query, params)

    const countQuery = query.select((eb) => eb.fn.countAll().as("total"))
    const dataQuery = query
      .select([
        "wt.id",
        "wt.change_qty",
        "wt.created_at",
        "wt.updated_at",
        // // Program
        sql<{
          id: number
          name: string
        }>`JSON_OBJECT(
            'id', w_program.id,
            'name', w_program.name
          )`.as("program"),

        // // Entity (also used for vendor and customer)
        sql<{
          id: number
          name: string
          id_satu_sehat: number | null
          entity_tag: {
            id: number | null
            name: string | null
          }
          province: {
            id: number | null
            name: string | null
          }
          regency: {
            id: number | null
            name: string | null
          }
        }>`JSON_OBJECT(
            'id', we.id,
            'name', we.name,
            'id_satu_sehat', we.id_satu_sehat,
            'entity_tag', JSON_OBJECT(
              'id', et.id,
              'name', et.title
            ),
            'province', JSON_OBJECT(
              'id', l_province.id,
              'name', l_province.name
            ),
            'regency', JSON_OBJECT(
              'id', l_regency.id,
              'name', l_regency.name
            )
          )`.as("entity"),

        // // Vendor (same as entity)
        sql<{
          id: number
          name: string
          id_satu_sehat: number | null
        }>`JSON_OBJECT(
            'id', wo_vendor.id,
            'name', wo_vendor.name,
            'id_satu_sehat', wo_vendor.id_satu_sehat
          )`.as("vendor"),

        // // Customer (same as entity for now, might need different logic)
        sql<{
          id: number
          name: string
          id_satu_sehat: number | null
        }>`JSON_OBJECT(
            'id', wo_customer.id,
            'name', wo_customer.name,
            'id_satu_sehat', wo_customer.id_satu_sehat
          )`.as("customer"),

        // // Material
        sql<{
          id: number
          kfa_code: string | null
          name: string
          description: string | null
        }>`JSON_OBJECT(
            'id', wm.id,
            'kfa_code', wm.hierarchy_code,
            'name', wm.name,
            'unit_of_consumption', mu.name
          )`.as("material"),

        // // Parent Material
        sql<{
          id: number | null
          name: string | null
          kfa_code: string | null
        }>`JSON_OBJECT(
            'id', wmp.id,
            'name', wmp.name,
            'kfa_code', wmp.hierarchy_code
          )`.as("parent_material"),

        // // Activity
        sql<{
          id: number
          name: string
        }>`JSON_OBJECT(
            'id', wa.id,
            'name', wa.name
          )`.as("activity"),

        // // Transaction Type
        sql<{
          id: number | null
          title: string | null
        }>`JSON_OBJECT(
            'id', wtt.id,
            'title', wtt.title
          )`.as("transaction_type"),

        // // Transaction Purchase
        sql<{
          id: number | null
          year: number | null
          price: number | null
          total_price: number | null
          budget_source: {
            id: number | null
            name: string | null
          }
        }>`JSON_OBJECT(
            'id', wpc.id,
            'year', wpc.year,
            'price', wpc.price,
            'total_price', wpc.total_price,
            'budget_source', JSON_OBJECT(
              'id', wbs.id,
              'name', wbs.name
            )
          )`.as("transaction_purchase"),

        // // Stock
        sql<{
          id: number
          batch: {
            id: number | null
            code: string | null
            expired_date: Date | null
            production_date: Date | null
            status: number | null
            manufacture: {
              id: number | null
              name: string | null
              address: string | null
            }
          }
        }>`JSON_OBJECT(
            'id', ws.id,
            'batch', JSON_OBJECT(
              'id', wb.id,
              'code', wb.code,
              'expired_date', wb.expired_date,
              'production_date', wb.production_date,
              
              'manufacture', JSON_OBJECT(
                'id', wmf.id,
                'name', wmf.name,
                'address', wmf.address
              )
            )
          )`.as("stock"),
      ])
      .offset((params.page - 1) * params.paginate)
      .limit(params.paginate)
      .orderBy("wt.updated_at", "desc")

    const [countResult, data] = await Promise.all([
      countQuery.executeTakeFirst(),
      dataQuery.execute(),
    ])

    return {
      page: params.page,
      item_per_page: params.paginate,
      total_item: Number(countResult?.total ?? 0),
      total_page: Math.ceil(
        (Number(countResult?.total ?? 0) || 0) / params.paginate
      ),
      list_pagination: [10, 25, 50, 100],
      data,
    }
  }
}
