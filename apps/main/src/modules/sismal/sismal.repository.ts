import { Context } from "hono"
import { sql } from "kysely"
import moment from "moment"
import {
  SismalOrdersQueriesType,
  SismalTransactionsQueriesType,
} from "./sismal.schema.js"
export default class SismalRepository {
  constructor() {}

  async getAllTransactions(c: Context, params: SismalTransactionsQueriesType) {
    const {
      page,
      paginate,
      activity_id,
      transaction_type_id,
      start_date,
      end_date,
      entity_tag_id,
      province_id,
    } = params

    let query = c.var.trx
      .selectFrom("ws_transactions as wt")
      .leftJoin("ws_entities as we", "wt.entity_id", "we.id")
      .leftJoin("ws_activities as wa", "wt.activity_id", "wa.id")
      .leftJoin("ws_stocks as ws", "wt.stock_id", "ws.id")
      .leftJoin("ws_materials as wm", "ws.material_id", "wm.id")
      .leftJoin("ws_batches as wb", "ws.batch_id", "wb.id")
      .leftJoin("ws_users as u_created", "wt.created_by", "u_created.id")
      .select((eb) => [
        eb.ref("we.code").as("entity_code"),
        eb.ref("we.id_satu_sehat").as("entity_id_satu_sehat"),
        eb.ref("we.name").as("entity_name"),
        eb.ref("wm.code").as("material_code"),
        eb.ref("wm.hierarchy_code").as("material_kfa_code"),
        eb.ref("wm.name").as("material_name"),
        eb.ref("wt.transaction_reason_id").as("transaction_reason_id"),
        eb.ref("wb.code").as("batch_code"),
        eb.ref("wb.expired_date").as("batch_expired_date"),
        eb.ref("wt.change_qty").as("change_qty"),
        eb.ref("u_created.username").as("user_created_username"),
      ])
      .where("wa.program_id", "=", c.var.programId)

    if (activity_id) {
      const activityIds = activity_id
        .split(",")
        .map((id) => parseInt(id.trim()))

      query = query.where("wt.activity_id", "in", activityIds)
    }

    if (transaction_type_id) {
      query = query.where("wt.transaction_type_id", "=", transaction_type_id)
    }

    if (start_date) {
      query = query.where(
        "wt.created_at",
        ">=",
        sql<Date>`${moment(start_date).format("YYYY-MM-DD 00:00:00")}`
      )
    }

    if (end_date) {
      query = query.where(
        "wt.created_at",
        "<=",
        sql<Date>`${moment(end_date).format("YYYY-MM-DD 23:59:59")}`
      )
    }

    if (entity_tag_id) {
      query = query.where("we.entity_tag_id", "=", entity_tag_id)
    }

    if (province_id) {
      query = query.where("we.province_id", "=", province_id)
    }

    const countQuery = query.select((eb) => eb.fn.countAll().as("total"))
    const dataQuery = query.offset((page - 1) * paginate).limit(paginate)
    const [count, data] = await Promise.all([
      countQuery.executeTakeFirst(),
      dataQuery.execute(),
    ])

    return {
      total: Number(count?.total || 0),
      page,
      paginate,
      data,
    }
  }

  async getAllOrders(c: Context, params: SismalOrdersQueriesType) {
    const {
      page,
      paginate,
      from_date,
      to_date,
      entity_tag_id,
      entity_province_id,
      activity_id,
      customer_id,
      type,
      status,
    } = params

    let query = c.var.trx
      .selectFrom("ws_orders as wso")
      .innerJoin("ws_entities as wse_customer", (join) =>
        join
          .onRef("wse_customer.id", "=", "wso.customer_id")
          .on("wse_customer.deleted_at", "is", null)
      )
      .innerJoin("ws_entities as wse_vendor", (join) =>
        join
          .onRef("wse_vendor.id", "=", "wso.vendor_id")
          .on("wse_vendor.deleted_at", "is", null)
      )
      .innerJoin("ws_activities as wsa", (join) =>
        join
          .onRef("wsa.id", "=", "wso.activity_id")
          .on("wsa.deleted_at", "is", null)
      )
      .leftJoin("locations as province_customer", (join) =>
        join.onRef("province_customer.id", "=", "wse_customer.province_id")
      )
      .leftJoin("locations as regency_customer", (join) =>
        join.onRef("regency_customer.id", "=", "wse_customer.regency_id")
      )
      .select([
        "wso.id",
        "wso.created_at",
        "wso.order_status_id as status",
        "wso.total_order_items as total_order_item",
        "wse_customer.code as customer_code",
        "wse_customer.id_satu_sehat as customer_id_satu_sehat",
        "wse_customer.name as customer_name",
        "province_customer.id as customer_province_id",
        "regency_customer.id as customer_regency_id",
        "wse_vendor.code as vendor_code",
        "wse_vendor.id_satu_sehat as vendor_id_satu_sehat",
        "wse_vendor.name as vendor_name",
      ])
      .where("wso.deleted_at", "is", null)
      .where("wso.activity_id", "is not", null)
      .where("wsa.program_id", "=", c.var.programId)

    if (activity_id) {
      query = query.where("wso.activity_id", "=", activity_id)
    }

    if (customer_id) {
      query = query.where("wso.customer_id", "=", customer_id)
    }

    if (type) {
      query = query.where("wso.order_type_id", "=", type)
    }

    if (status) {
      query = query.where("wso.order_status_id", "=", status)
    }

    if (entity_tag_id) {
      query = query.where("wse_customer.entity_tag_id", "=", entity_tag_id)
    }

    if (entity_province_id) {
      query = query.where(
        "wse_customer.province_id",
        "=",
        String(entity_province_id)
      )
    }

    if (from_date) {
      query = query.where("wso.created_at", ">=", new Date(from_date))
    }

    if (to_date) {
      query = query.where("wso.created_at", "<=", new Date(to_date))
    }

    const countQuery = query.select((eb) => eb.fn.countAll().as("total"))
    const dataQuery = query.offset((page - 1) * paginate).limit(paginate)
    const [count, data] = await Promise.all([
      countQuery.executeTakeFirst(),
      dataQuery.execute(),
    ])

    return {
      total: Number(count?.total || 0),
      page,
      paginate,
      data,
    }
  }

  async getOrderItems(c: Context, orderId: number) {
    return await c.var.trx
      .selectFrom("ws_order_item_stocks as wois")
      .leftJoin("ws_materials as wsm", (join) =>
        join
          .onRef("wois.material_id", "=", "wsm.id")
          .on("wsm.program_id", "=", c.var.programId)
          .on("wsm.deleted_at", "is", null)
      )
      .select([
        "wois.id",
        "wois.qty",
        "wois.material_id as master_material_id",
        "wsm.name as material_name",
        "wsm.unit_of_consumption as material_unit",
        "wsm.hierarchy_code as material_kfa_code",
        "wsm.code as material_code",
      ])
      .where("wois.order_id", "=", orderId)
      .where("wois.deleted_at", "is", null)
      .execute()
  }
}
