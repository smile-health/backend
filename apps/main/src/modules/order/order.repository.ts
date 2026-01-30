/* eslint-disable @typescript-eslint/no-explicit-any */
import { DATASOURCE } from "@/common/constants/common.js"
import { DEVICE_TYPE } from "@/common/constants/device.js"
import { KFA_LEVEL_CODE_TO_ID } from "@/common/constants/material.js"
import { IS_FROM_TICKETING } from "@/common/constants/order.js"
import { USER_ROLE } from "@/common/constants/user.js"
import { datamart } from "@/common/infrastructure/database/datamart.js"
import { slave } from "@/common/infrastructure/database/slave.js"
import { DB, WsEntities } from "@/common/infrastructure/database/types/db.js"
import { Context } from "@smile-health/lib/types/context.js"
import { Context as HonoContext } from "hono"
import { Kysely, Selectable, sql } from "kysely"
import _, { pick } from "lodash"
import moment from "moment"
import { BaseRepository } from "../base.repository.js"
import { GetOrderQueries, GetStatusCountQueries } from "./order.schema.js"
import { Datamart } from "@/common/infrastructure/database/types/datamart.js"
import env from "@/config/env.js"
import { de } from "@faker-js/faker"

export class OrderRepository extends BaseRepository<"ws_orders"> {
  constructor(filterProgram = false, filterActivity = true) {
    super("ws_orders", filterProgram, filterActivity)
  }

  #generateQueryListOrderWhereClause(
    query: any,
    params: GetOrderQueries,
    entityId: number | undefined,
    roleId: number | undefined,
    userEntity: Selectable<WsEntities>,
    deviceType: number
  ) {
    const {
      order_number,
      activity_id,
      from_date,
      to_date,
      updated_from_date,
      updated_to_date,
      purpose,
      service_type,
      entity_province_id,
      entity_city_id,
      entity_puskesmas_id,
      status,
      status_ids,
      type,
      type_ids,
    } = params
    if (order_number) {
      query = query.where("wso.order_id", "in", order_number)
    }

    if (activity_id) {
      query = query.where("wso.activity_id", "=", activity_id)
    }

    if (service_type) {
      query = query.where("wso.delivery_type_id", "=", service_type)
    }

    if (from_date || to_date) {
      query = this.applyDateFilter(query, from_date, to_date)
    }

    if (updated_from_date || updated_to_date) {
      query = this.applyDateFilter(
        query,
        updated_from_date,
        updated_to_date,
        "order_updated_at"
      )
    }

    if (status_ids) {
      query = query.where("wso.status_id", "in", status_ids)
    } else if (status) {
      query = query.where("wso.status_id", "=", status)
    }

    if (type) {
      query = query.where("wso.type_id", "=", type)
    } else if (type_ids) {
      query = query.where("wso.type_id", "in", type_ids)
    }

    if (purpose === "purchase" || purpose === "sales") {
      let entityIdLocation: number | undefined = undefined
      if (entity_puskesmas_id) {
        entityIdLocation = entity_puskesmas_id
      } else if (entity_city_id) {
        entityIdLocation = entity_city_id
      } else if (entity_province_id) {
        entityIdLocation = entity_province_id
      }

      if (purpose === "purchase") {
        query = this.#filterLocationOrder(
          query,
          params,
          roleId,
          "customer",
          userEntity,
          deviceType,
          false,
          entityId
        )

        query = this.applyPurposePurchaseFilter(
          query,
          params,
          entityIdLocation,
          entityId
        )
      } else if (purpose === "sales") {
        query = this.#filterLocationOrder(
          query,
          params,
          roleId,
          "vendor",
          userEntity,
          deviceType,
          false,
          entityId
        )

        query = this.applyPurposeSalesFilter(
          query,
          params,
          entityIdLocation,
          entityId
        )
      }
    } else {
      query = this.applyRolesFilter(query, params, roleId!, entityId)
    }

    return query
  }

  #filterLocationOrder(
    query: any,
    params: GetOrderQueries,
    roleId: number | undefined,
    flex: string,
    userEntity: Selectable<WsEntities>,
    deviceType: number,
    stream: boolean,
    entityId?: number
  ) {
    const {
      province_id,
      regency_id,
      vendor_id,
      customer_id,
      is_from_ticketing,
      entity_tag_id,
    } = params

    if (roleId === USER_ROLE.SUPERADMIN || roleId === USER_ROLE.ADMIN) {
      if (province_id) {
        query = stream
          ? query.where(`wse_${flex}.province_id`, "=", province_id)
          : query.where(`${flex}_province_id`, "=", province_id)
      }
      if (regency_id) {
        query = stream
          ? query.where(`wse_${flex}.regency_id`, "=", regency_id)
          : query.where(`${flex}_regency_id`, "=", regency_id)
      }
      if (flex === "vendor" && vendor_id) {
        query = stream
          ? query.where(`wse_${flex}.id`, "=", vendor_id)
          : query.where(`${flex}_id`, "=", vendor_id)
      }
      if (flex === "customer" && customer_id) {
        query = stream
          ? query.where(`wse_${flex}.id`, "=", customer_id)
          : query.where(`${flex}_id`, "=", customer_id)
      }

      return query
    }

    switch (roleId) {
      case USER_ROLE.MANAGER:
        // Handle for web
        if (
          deviceType === DEVICE_TYPE.web ||
          is_from_ticketing === IS_FROM_TICKETING.TRUE
        ) {
          query = stream
            ? query.where(
                `wse_${flex}.province_id`,
                "=",
                Number(userEntity.province_id)
              )
            : query.where(
                `${flex}_province_id`,
                "=",
                Number(userEntity.province_id)
              )

          // Manager Level Regency
          if (userEntity.entity_tag_id === 7) {
            if (Number(userEntity.regency_id)) {
              query = stream
                ? query.where(
                    `wse_${flex}.regency_id`,
                    "=",
                    Number(userEntity.regency_id)
                  )
                : query.where(
                    `${flex}_regency_id`,
                    "=",
                    Number(userEntity.regency_id)
                  )
            } else {
              query = stream
                ? query.where(`wse_${flex}.id`, "=", Number(entityId))
                : query.where(`${flex}_id`, "=", Number(entityId))
            }
          } else {
            // Manager Level Province
            if (regency_id && userEntity.entity_tag_id === 5) {
              query = stream
                ? query.where(`wse_${flex}.regency_id`, "=", regency_id)
                : query.where(`${flex}_regency_id`, "=", regency_id)
            }
          }

          if (flex === "vendor" && vendor_id) {
            query = stream
              ? query.where(`wse_${flex}.id`, "=", vendor_id)
              : query.where(`${flex}_id`, "=", vendor_id)
          }
          if (flex === "customer" && customer_id) {
            query = stream
              ? query.where(`wse_${flex}.id`, "=", customer_id)
              : query.where(`${flex}_id`, "=", customer_id)
          }
        }

        // Handle for mobile
        if (deviceType === DEVICE_TYPE.mobile && !is_from_ticketing) {
          if (flex === "vendor") {
            query = stream
              ? query.where(`wse_${flex}.id`, "=", entityId)
              : query.where(`${flex}_id`, "=", entityId)

            if (vendor_id) {
              query = stream
                ? query.where(`wse_customer.id`, "=", vendor_id)
                : query.where(`customer_id`, "=", vendor_id)
            }
          }
          if (flex === "customer") {
            query = stream
              ? query.where(`wse_${flex}.id`, "=", entityId)
              : query.where(`${flex}_id`, "=", entityId)
            if (customer_id) {
              query = stream
                ? query.where(`wse_vendor.id`, "=", customer_id)
                : query.where(`vendor_id`, "=", customer_id)
            }
          }
        }
        return query
      case USER_ROLE.OPERATOR:
        query = stream
          ? query.where(`wse_${flex}.id`, "=", entityId)
          : query.where(`${flex}_id`, "=", entityId)
        return query
      case USER_ROLE.MANUFACTURE:
        query = stream
          ? query.where(`wse_${flex}.id`, "=", entityId)
          : query.where(`${flex}_id`, "=", entityId)
        return query
      default:
        query = stream
          ? query.where(`wse_${flex}.id`, "=", entityId)
          : query.where(`${flex}_id`, "=", entityId)
        return query
    }
  }

  private applyDateFilter(
    query: any,
    fromDate: string | undefined,
    toDate: string | undefined,
    field = "order_created_at"
  ) {
    const startDate = fromDate
      ? moment(fromDate).startOf("day").format("YYYY-MM-DD HH:mm:ss")
      : null
    const endDate = toDate
      ? moment(toDate).endOf("day").format("YYYY-MM-DD HH:mm:ss")
      : null

    if (startDate && endDate) {
      query = query
        .where(`wso.${field}`, ">=", sql<Date>`${startDate}`)
        .where(`wso.${field}`, "<=", sql<Date>`${endDate}`)
    } else if (startDate) {
      query = query.where(`wso.${field}`, ">=", sql<Date>`${startDate}`)
    } else if (endDate) {
      query = query.where(`wso.${field}`, "<=", sql<Date>`${endDate}`)
    }
    return query
  }

  private applyPurposePurchaseFilter(
    query: any,
    params: GetOrderQueries,
    entityIdLocation: number | undefined,
    entityId?: number
  ) {
    const vendorId = params.vendor_id ?? params.entity_id

    if (entityIdLocation) {
      query = query.where("customer_id", "=", entityIdLocation)
    }

    if (params.entity_tag_id) {
      query = query.where("customer_entity_tag_id", "=", params.entity_tag_id)
    }

    if (vendorId) {
      query = query.where("vendor_id", "=", vendorId)
    }
    return query
  }

  private applyPurposeSalesFilter(
    query: any,
    params: GetOrderQueries,
    entityIdLocation: number | undefined,
    entityId?: number
  ) {
    if (entityIdLocation) {
      query = query.where("wso.vendor_id", "=", entityIdLocation)
    }

    if (params.entity_tag_id) {
      query = query.where("wso.vendor_entity_tag_id", "=", params.entity_tag_id)
    }

    if (params.customer_id)
      query = query.where("wso.customer_id", "=", params.customer_id)

    return query
  }

  private applyRolesFilter(
    query: any,
    params: GetOrderQueries,
    roleId: number,
    entityId?: number
  ) {
    const { entity_id, vendor_id, customer_id } = params
    if (roleId === USER_ROLE.OPERATOR || roleId === USER_ROLE.OPERATOR_COVID) {
      if (entityId)
        query = query.where("wso.customer_id", "=", Number(entityId))
      if (vendor_id && entity_id)
        query = query.where("wso.vendor_id", "=", entity_id)
    } else if (roleId === USER_ROLE.MANAGER) {
      if (entityId) query = query.where("wso.vendor_id", "=", Number(entityId))
      if (customer_id) query = query.where("wso.customer_id", "=", customer_id)
    }

    return query
  }

  async getListOrder(
    c: HonoContext,
    params: GetOrderQueries,
    entityId: number | undefined,
    roleId: number | undefined,
    programId: number,
    userEntity: Selectable<WsEntities>,
    deviceType: number
  ) {
    const { page, paginate } = params
    const offset = (page - 1) * paginate

    const source = env.ORDER_LIST_SOURCE
    let useDatamart = false
    let query: Kysely<DB> | Kysely<Datamart>

    switch (source) {
      case DATASOURCE.DATAMART:
        query = c.var.datamart
        useDatamart = true
        break
      case DATASOURCE.CLICKHOUSE:
        query = c.var.slave
        break
      default:
        query = c.var.trx
        break
    }

    query = useDatamart
      ? query
          .selectFrom(sql`datamart_order_list_v5 as wso FINAL`)
          .where("wso.deleted_at", "is", null)
      : query.selectFrom("ws_order_lists as wso")

    query = this.#generateQueryListOrderWhereClause(
      query,
      params,
      entityId,
      roleId,
      userEntity,
      deviceType
    )

    if (params.integration) {
      query =
        source === DATASOURCE.MYSQL
          ? query.where(
              sql`JSON_EXTRACT(wso.metadata, '$.client_key') = ${params.integration}`
            )
          : query.where(
              sql`JSONExtractString(wso.metadata, 'client_key') = ${params.integration}`
            )
    }

    const list = await query
      .where("wso.program_id", "=", programId)
      .select([
        "wso.order_id",
        "wso.device_type",
        "wso.status_id",
        "wso.type_id",
        "wso.vendor_id",
        "wso.customer_id",
        "wso.activity_id",
        "wso.activity_name",
        "wso.metadata",
        "wso.order_created_at",
        "wso.order_updated_at",
        "wso.total_order_items",
        "wso.user_created_by",
        "wso.delivery_type_name",
        "wso.delivery_type_id",
      ])
      .select(sql`COUNT(*) OVER ()`.as("total"))
      .limit(paginate)
      .offset(offset)
      .orderBy("wso.order_id", "desc")
      .execute()

    return { list, total: Number(list[0]?.total) }
  }

  async getListUser(c: Context<DB>, listID: number[]) {
    return c.var.trx
      .selectFrom("ws_users")
      .select(["id", "firstname", "lastname", "email", "username"])
      .where("deleted_by", "is", null)
      .where("id", "in", listID)
      .execute()
  }

  async getStatusOrderCount(
    c: HonoContext,
    params: GetStatusCountQueries,
    entityId: number | undefined,
    programId: number,
    roleId: number
  ) {
    const {
      type,
      purpose,
      order_id,
      activity_id,
      vendor_id,
      customer_id,
      from_date,
      to_date,
      integration,
    } = params

    const source = env.ORDER_LIST_SOURCE
    let useDatamart = false
    let query: Kysely<DB> | Kysely<Datamart>

    switch (source) {
      case DATASOURCE.DATAMART:
        query = c.var.datamart
        useDatamart = true
        break
      case DATASOURCE.CLICKHOUSE:
        query = c.var.slave
        break
      default:
        query = c.var.trx
        break
    }

    query = useDatamart
      ? query
          .selectFrom(sql`datamart_order_list_v5 as wso FINAL`)
          .where("wso.deleted_at", "is", null)
      : query.selectFrom("ws_order_lists as wso")

    if (from_date || to_date) {
      query = this.applyDateFilter(query, from_date, to_date)
    }

    if (purpose) {
      switch (roleId) {
        case USER_ROLE.MANAGER:
          query =
            purpose === "sales"
              ? query.where("wso.vendor_id", "=", entityId!)
              : query.where("wso.customer_id", "=", entityId!)
          break
        case USER_ROLE.OPERATOR:
          query =
            purpose === "sales"
              ? query.where("wso.vendor_id", "=", entityId!)
              : query.where("wso.customer_id", "=", entityId!)
          break
      }
    }

    const result = await query
      .select(["wso.status_id", sql`count(*)`.as("count")])
      .$if(!!order_id, (qb) => qb.where("wso.order_id", "=", order_id!))
      .$if(!!activity_id, (qb) =>
        qb.where("wso.activity_id", "=", activity_id!)
      )
      .$if(!!type, (qb) => qb.where("wso.type_id", "=", type!))
      .$if(!!customer_id, (qb) =>
        qb.where("wso.customer_id", "=", customer_id!)
      )
      .$if(!!vendor_id, (qb) => qb.where("wso.vendor_id", "=", vendor_id!))
      .$if(!!integration, (qb) =>
        source === DATASOURCE.MYSQL
          ? qb.where(
              sql`JSON_EXTRACT(wso.metadata, '$.client_key') = ${integration}`
            )
          : qb.where(
              sql`JSONExtractString(wso.metadata, 'client_key') = ${integration}`
            )
      )
      .where("wso.program_id", "=", programId)
      .groupBy("wso.status_id")
      .orderBy("wso.status_id")
      .execute()

    return result
  }

  async getListOrderStatus(c: Context<DB>, params: GetStatusCountQueries) {
    const { type } = params
    // Type = 2 is for DROPPING
    return c.var.trx
      .selectFrom("ws_order_statuses")
      .$if(type === 2, (qb) => qb.where("name", "!=", "pending"))
      .$if(type === 2, (qb) => qb.where("name", "!=", "canceled"))
      .select(["id"])
      .execute()
  }

  async getDeliveryType(c: Context<DB>) {
    return c.var.trx
      .selectFrom("ws_delivery_types")
      .select(["id", "name"])
      .where("deleted_at", "is", null)
      .execute()
  }

  async getOrderById(c: Context<DB>, id: number, programId: number) {
    return await c.var.trx
      .selectFrom("ws_orders as wso")
      .selectAll()
      .leftJoin("ws_activities as wsa", (join) =>
        join
          .onRef("wsa.id", "=", "wso.activity_id")
          .on("wsa.program_id", "=", programId)
          .on("wsa.deleted_at", "is", null)
      )
      .where("wso.id", "=", id)
      .where("wso.deleted_at", "is", null)
      .executeTakeFirst()
  }

  async getOrderDetailById(c: Context<DB>, id: number, programId: number) {
    return await c.var.trx
      .selectFrom("ws_orders as wso")
      .innerJoin("ws_activities as wsa", (join) =>
        join
          .onRef("wsa.id", "=", "wso.activity_id")
          .on("wsa.program_id", "=", programId)
          .on("wsa.deleted_at", "is", null)
      )
      .leftJoin("ws_order_audits as woa", (join) =>
        join
          .onRef("wso.id", "=", "woa.order_id")
          .on("woa.deleted_at", "is", null)
      )
      .leftJoin("ws_entities as customer", (join) =>
        join
          .onRef("wso.customer_id", "=", "customer.id")
          .on("customer.program_id", "=", programId)
          .on("customer.deleted_at", "is", null)
      )
      .leftJoin("ws_entities as vendor", (join) =>
        join
          .onRef("wso.vendor_id", "=", "vendor.id")
          .on("vendor.program_id", "=", programId)
          .on("vendor.deleted_at", "is", null)
      )
      .leftJoin("ws_order_statuses as wos", (join) =>
        join
          .onRef("wso.order_status_id", "=", "wos.id")
          .on("wos.deleted_at", "is", null)
      )
      .leftJoin("ws_order_types as wot", (join) =>
        join
          .onRef("wso.order_type_id", "=", "wot.id")
          .on("wot.deleted_at", "is", null)
      )
      .leftJoin("ws_delivery_types as wdt", (join) =>
        join
          .onRef("wso.delivery_type_id", "=", "wdt.id")
          .on("wdt.deleted_at", "is", null)
      )
      .leftJoin("ws_other_reasons as wor", (join) =>
        join
          .onRef("wso.id", "=", "wor.source_id")
          .on("wor.source_type", "=", "order")
          .on("wor.deleted_at", "is", null)
      )
      .leftJoin("ws_order_cancel_reasons as wocr", (join) =>
        join
          .onRef("wso.order_cancel_reason_id", "=", "wocr.id")
          .on("wocr.deleted_at", "is", null)
      )
      .select([
        "wso.id",
        "wso.device_type",
        "wso.customer_id",
        "wso.vendor_id",
        "wso.order_status_id as status",
        "wso.order_type_id as type",
        "woa.required_date",
        "woa.estimated_date",
        "woa.actual_shipment_date",
        "wso.purchase_ref",
        "wso.sales_ref",
        "wso.delivery_number",
        "woa.drafted_at",
        "woa.validated_at",
        "woa.confirmed_at",
        "woa.shipped_at",
        "woa.fulfilled_at",
        "woa.cancelled_at",
        "woa.allocated_at",
        "woa.created_at",
        "woa.updated_at",
        "wso.deleted_at",
        "wso.taken_by_customer",
        "wdt.name as delivery_type",
        "wso.no_document as doc_no",
        "wso.notes",
        "wso.no_po as po_no",
        "wso.activity_id",
        "wso.total_order_items",
        "wso.is_allocated",
        "woa.drafted_by",
        "woa.validated_by",
        "woa.confirmed_by",
        "woa.shipped_by",
        "woa.fulfilled_by",
        "woa.cancelled_by",
        "woa.allocated_by",
        "wso.created_by",
        "wso.updated_by",
        "wso.deleted_by",
        "wor.content as other_reason_cancel",
        "wso.order_cancel_reason_id",
        "wso.metadata",
      ])
      .where("wso.id", "=", id)
      .where("wso.deleted_at", "is", null)
      .executeTakeFirst()
  }

  async getOrderDetailItemStockByOrderId(
    c: Context<DB>,
    orderId: number,
    programId: number
  ) {
    return await c.var.trx
      .selectFrom("ws_order_item_stocks as woi")
      .leftJoin("ws_materials as wsm", (join) =>
        join
          .onRef("woi.material_id", "=", "wsm.id")
          .on("wsm.program_id", "=", programId)
          .on("wsm.deleted_at", "is", null)
      )
      .leftJoin("materials as p", "wsm.parent_global_id", "p.id")
      .leftJoin("material_levels as ml", (join) =>
        join
          .onRef("woi.order_item_kfa_id", "=", "ml.id")
          .onRef("ml.id", "=", "wsm.material_level_id")
          .on("ml.deleted_at", "is", null)
      )
      .leftJoin("ws_stocks as wss", (join) =>
        join
          .onRef("woi.stock_id", "=", "wss.id")
          .on("wss.deleted_at", "is", null)
      )
      .leftJoin("ws_entities as wse", (join) =>
        join
          .onRef("wse.id", "=", "wss.entity_id")
          .on("wse.program_id", "=", programId)
          .on("wse.deleted_at", "is", null)
      )
      .leftJoin("ws_activities as wsa", (join) =>
        join
          .onRef("wsa.id", "=", "wss.activity_id")
          .on("wsa.program_id", "=", programId)
          .on("wsa.deleted_at", "is", null)
      )
      .leftJoin("ws_order_stock_statuses as woss", (join) =>
        join
          .onRef("woi.order_stock_status_id", "=", "woss.id")
          .on("woss.deleted_at", "is", null)
      )
      .leftJoin("ws_order_reasons as wor", (join) =>
        join
          .onRef("woi.order_reason_id", "=", "wor.id")
          .on("wor.deleted_at", "is", null)
      )
      .leftJoin("ws_other_reasons as wor2", (join) =>
        join
          .onRef("woi.id", "=", "wor2.source_id")
          .on("wor2.source_type", "=", "order_item")
          .on("wor2.deleted_at", "is", null)
      )
      .leftJoin("ws_batches as wsb", (join) =>
        join
          .onRef("wss.batch_id", "=", "wsb.id")
          .on("wsb.deleted_at", "is", null)
      )
      .leftJoin("ws_budget_sources as wbs", (join) =>
        join
          .onRef("wss.budget_source_id", "=", "wbs.id")
          .on("wbs.deleted_at", "is", null)
      )
      .leftJoin("ws_manufactures as wm", (join) =>
        join
          .onRef("wsb.manufacture_id", "=", "wm.id")
          .on("wm.program_id", "=", programId)
          .on("wm.deleted_at", "is", null)
      )
      .select([
        "woi.id",
        "woi.order_id",
        "woi.qty",
        "woi.recommended_stock",
        "woi.created_at",
        "woi.order_reason_id as reason_id",
        "wor.name as reason_name",
        "wor2.content as other_reason",
        "wsm.material_level_id as kfa_level_id",
        "woi.material_id",
        "wsm.name as material_name",
        "wsm.hierarchy_code as material_code",
        "p.name as parent_material_name",
        "p.hierarchy_code as parent_material_code",
        "wsm.material_type",
        "wsm.unit_of_consumption",
        "wsm.unit_of_distribution",
        "ml.name as kfa_level_name",
        "wsm.consumption_unit_per_distribution_unit",
        "woi.stock_id",
        "wss.activity_id",
        "wsa.name as activity_name",
        "woi.order_stock_status_id",
        "woi.allocated_qty",
        "woi.received_qty",
        "woi.confirmed_qty",
        "woi.ordered_qty",
        "wss.batch_id",
        "wsb.code",
        "wsb.expired_date",
        "wsb.production_date",
        "wm.id as manufacture_id",
        "wm.name as manufacture_name",
        "wsm.is_managed_in_batch",
        "wsm.is_temperature_sensitive",
        "woi.parent_material_id",
        "wsm.material_level_id",
        "wsm.parent_id",
        "woi.fulfill_stock_status_id",
        "woi.validated_qty",
        "wbs.id as budget_source_id",
        "wbs.name as budget_source_name",
        "wss.year",
        "wss.price",
        "wsm.unit_of_distribution_id",
        "wsm.unit_of_distribution as unit_of_distribution_name",
      ])
      .where("woi.order_id", "=", orderId)
      .where("woi.deleted_at", "is", null)
      .where("p.deleted_at", "is", null)
      .execute()
  }

  async getOrderDetailCommentByOrderId(
    c: Context<DB>,
    orderId: number,
    programId: number
  ) {
    return await c.var.trx
      .selectFrom("ws_order_comments as woc")
      .leftJoin("ws_users as wsu", (join) =>
        join
          .onRef("woc.user_id", "=", "wsu.id")
          .on("wsu.program_id", "=", programId)
      )
      .select([
        "woc.id",
        "woc.comment",
        "woc.created_at",
        "woc.order_status_id",
        "wsu.id as user_id",
        "wsu.firstname",
        "wsu.lastname",
      ])
      .where("woc.order_id", "=", orderId)
      .where("woc.deleted_at", "is", null)
      .orderBy("woc.updated_at", "desc")
      .execute()
  }

  async getListWsEntities(c: Context<DB>, listID: number[]) {
    const rows = await c.var.trx
      .selectFrom("ws_entities as e")
      .leftJoin("entity_types as et", "e.type", "et.id")
      .selectAll("e")
      .select("et.name as entity_type")
      .where("e.deleted_at", "is", null)
      .where("e.id", "in", listID)
      .execute()

    return rows.map((row) => ({
      ...row,
      type_label: c.var.t(`entity_type.label.${row.entity_type}`),
    }))
  }

  async getListWsActivities(c: Context<DB>, listID: number[]) {
    return c.var.trx
      .selectFrom("ws_activities")
      .select(["id", "name"])
      .where("deleted_at", "is", null)
      .where("id", "in", listID)
      .execute()
  }

  async getListOrderStream(
    c: Context<DB>,
    params: GetOrderQueries,
    entityId: number | undefined,
    roleId: number | undefined,
    programId: number,
    userEntity: Selectable<WsEntities>,
    deviceType: number
  ) {
    let query = datamart
      ? datamart.selectFrom(sql`datamart_order_list_v5 as wso FINAL`)
      : slave.selectFrom("ws_order_lists as wso")

    query = query
      .leftJoin(
        datamart
          ? "raw_ws_order_item_stocks as wsois"
          : "ws_order_item_stocks as wsois",
        (join) =>
          join
            .onRef("wsois.order_id", "=", "wso.order_id")
            .on("wsois.deleted_at", "is", null)
      )
      .leftJoin(
        datamart ? "raw_ws_stocks as wss" : "ws_stocks as wss",
        (join) =>
          join
            .onRef("wss.id", "=", "wsois.stock_id")
            .on("wss.deleted_at", "is", null)
      )
      .leftJoin(
        datamart ? "raw_ws_materials as wsmp" : "ws_materials as wsmp",
        (join) =>
          join
            .onRef("wsmp.id", "=", "wss.parent_material_id")
            .on("wsmp.deleted_at", "is", null)
            .on("wsmp.program_id", "=", programId)
      )
      .leftJoin(
        datamart ? "raw_ws_materials as wsm" : "ws_materials as wsm",
        (join) =>
          join
            .onRef("wsm.id", "=", "wss.material_id")
            .on("wsm.deleted_at", "is", null)
            .on("wsm.program_id", "=", programId)
      )
      .leftJoin(
        datamart ? "raw_ws_order_reasons as wsor" : "ws_order_reasons as wsor",
        (join) =>
          join
            .onRef("wsor.id", "=", "wsois.order_reason_id")
            .on("wsm.deleted_at", "is", null)
      )
      .leftJoin(
        datamart ? "raw_ws_batches as wsb" : "ws_batches as wsb",
        (join) =>
          join
            .onRef("wsb.id", "=", "wss.batch_id")
            .on("wsb.deleted_at", "is", null)
      )
      .leftJoin(
        datamart
          ? "raw_ws_order_comments as wsoc_shipped"
          : "ws_order_comments as wsoc_shipped",
        (join) =>
          join
            .onRef("wsoc_shipped.order_id", "=", "wso.order_id")
            .on("wsoc_shipped.order_status_id", "=", 4)
            .on("wsoc_shipped.deleted_at", "is", null)
      )
      .leftJoin(
        datamart
          ? "raw_ws_order_comments as wsoc_confirmed"
          : "ws_order_comments as wsoc_confirmed",
        (join) =>
          join
            .onRef("wsoc_confirmed.order_id", "=", "wso.order_id")
            .on("wsoc_confirmed.order_status_id", "=", 2)
            .on("wsoc_confirmed.deleted_at", "is", null)
      )
      .leftJoin(
        datamart ? "raw_ws_order_audits as wsoa" : "ws_order_audits as wsoa",
        (join) =>
          join
            .onRef("wsoa.order_id", "=", "wso.order_id")
            .on("wsoa.deleted_at", "is", null)
      )

    query = this.#generateQueryListOrderWhereClause(
      query,
      params,
      entityId,
      roleId,
      userEntity,
      deviceType
    )

    const listOrder = query
      .where("wso.program_id", "=", programId)
      .select([
        "wso.order_id as id",
        "wso.total_order_items",
        "wso.doc_no as no_document",
        "wso.delivery_number",
        "wso.notes",
        "wso.order_created_at as created_at",
        "wso.created_by_name as created_by",
        "wso.order_updated_at as updated_at",
        "wso.updated_by_name as updated_by",
        "wso.status_name as status",
        "wso.customer_name",
        "wso.vendor_name",
        "wsmp.name as material_name_kfa",
        "wsm.name as material_name",
        "wsor.name as reason",
        "wsois.received_qty",
        "wso.activity_name",
        "wsb.code as code_batch",
        "wsb.expired_date as expired_date_batch",
        "wsois.allocated_qty",
        "wso.delivery_type_name",
        "wsoa.released_date",
        "wsois.confirmed_qty",
        "wsoc_shipped.comment as comment_shipped",
        "wsoc_confirmed.comment as comment_confirmed",
        "wso.confirmed_at",
        "wso.allocated_at",
        "wso.shipped_at",
        "wso.vendor_province_id as province_id",
        "wso.vendor_regency_id as regency_id",
        "wso.customer_province_id",
        "wso.customer_regency_id",
      ])
      .groupBy("wso.order_id")
      .orderBy("wso.order_updated_at", "desc")
      .stream()

    return listOrder
  }

  async getListOrderStreamV2(
    c: Context<DB>,
    params: GetOrderQueries,
    entityId: number | undefined,
    roleId: number | undefined,
    programId: number,
    userEntity: Selectable<WsEntities>,
    deviceType: number
  ) {
    let query = c.var.trx
      .selectFrom("ws_order_lists as wso")
      .leftJoin("ws_order_item_stocks as wois", (join) =>
        join
          .onRef("wois.order_id", "=", "wso.order_id")
          .on("wois.deleted_at", "is", null)
      )
      .leftJoin("ws_stocks as wss", (join) =>
        join
          .onRef("wss.id", "=", "wois.stock_id")
          .on("wss.deleted_at", "is", null)
      )
      // Material KFA (level 3) → dari wss.material_id
      .leftJoin("ws_materials as wsm", (join) =>
        join
          .onRef("wsm.id", "=", "wss.material_id")
          .on("wsm.deleted_at", "is", null)
          .on("wsm.program_id", "=", programId)
      )
      // Material asal (level 2) → dari wss.parent_material_id
      .leftJoin("ws_materials as wsmp", (join) =>
        join
          .onRef("wsmp.id", "=", "wss.parent_material_id")
          .on("wsmp.deleted_at", "is", null)
          .on("wsmp.program_id", "=", programId)
      )
      // Material langsung dari order_item_material_id (untuk kasus stock_id null)
      .leftJoin("ws_materials as wsm_direct", (join) =>
        join
          .onRef("wsm_direct.id", "=", "wois.material_id")
          .on("wsm_direct.deleted_at", "is", null)
          .on("wsm_direct.program_id", "=", programId)
      )
      .leftJoin("ws_batches as wsb", (join) =>
        join
          .onRef("wsb.id", "=", "wss.batch_id")
          .on("wsb.deleted_at", "is", null)
      )
      .leftJoin("ws_order_reasons as wsor", (join) =>
        join
          .onRef("wsor.id", "=", "wois.order_reason_id")
          .on("wsor.deleted_at", "is", null)
      )
      .leftJoin("ws_order_comments as wsoc_shipped", (join) =>
        join
          .onRef("wsoc_shipped.order_id", "=", "wso.order_id")
          .on("wsoc_shipped.order_status_id", "=", 4)
          .on("wsoc_shipped.deleted_at", "is", null)
      )
      .leftJoin("ws_order_comments as wsoc_confirmed", (join) =>
        join
          .onRef("wsoc_confirmed.order_id", "=", "wso.order_id")
          .on("wsoc_confirmed.order_status_id", "=", 2)
          .on("wsoc_confirmed.deleted_at", "is", null)
      )
      .leftJoin("ws_order_audits as wsoa", (join) =>
        join
          .onRef("wsoa.order_id", "=", "wso.order_id")
          .on("wsoa.deleted_at", "is", null)
      )

    // Apply dynamic WHERE clause
    query = this.#generateQueryListOrderWhereClause(
      query,
      params,
      entityId,
      roleId,
      userEntity,
      deviceType
    )

    if (params.integration) {
      query = query.where(
        sql<boolean>`JSON_EXTRACT(wso.metadata, '$.client_key')`,
        "=",
        params.integration
      )
    }

    const listOrder = query
      .where("wso.program_id", "=", programId)
      .select([
        "wso.order_id as id",
        "wso.total_order_items",
        "wso.doc_no as no_document",
        "wso.delivery_number",
        "wso.notes",
        "wso.order_created_at as created_at",
        "wso.created_by_name as created_by",
        "wso.order_updated_at as updated_at",
        "wso.updated_by_name as updated_by",
        "wso.status_name as status",
        "wso.customer_name",
        "wso.vendor_name",
        "wso.confirmed_at",
        "wso.allocated_at",
        "wso.shipped_at",
        "wso.vendor_province_id as province_id",
        "wso.vendor_regency_id as regency_id",
        "wso.customer_province_id",
        "wso.customer_regency_id",
        "wso.activity_name",
        "wso.delivery_type_name",
        "wso.status_id",

        // Material KFA (level 3)
        sql<string>`CASE WHEN wsm.material_level_id = 3 THEN wsm.name ELSE NULL END`.as(
          "material_name"
        ),
        sql<number>`CASE WHEN wsm.material_level_id = 3 THEN wsm.material_level_id ELSE NULL END`.as(
          "material_level_id_child"
        ),

        // Material asal (level 2)
        sql<string>`CASE
          WHEN wsmp.material_level_id = 2 THEN wsmp.name
          WHEN wsm_direct.material_level_id = 2 THEN wsm_direct.name
          ELSE NULL
        END`.as("material_name_kfa"),
        sql<number>`CASE
          WHEN wsmp.material_level_id = 2 THEN wsmp.material_level_id
          WHEN wsm_direct.material_level_id = 2 THEN wsm_direct.material_level_id
          ELSE NULL
        END`.as("material_level_id_parent"),

        "wois.id as order_item_stock_id",
        "wois.material_id as order_item_material_id", // opsional
        "wois.stock_id",
        "wois.qty",
        "wois.ordered_qty",
        "wois.allocated_qty",
        "wois.confirmed_qty",
        "wois.received_qty",
        "wois.order_reason_id",
        "wsor.name as reason",
        "wsb.code as code_batch",
        "wsb.expired_date as expired_date_batch",
        "wsoa.released_date",
        "wsoc_shipped.comment as comment_shipped",
        "wsoc_confirmed.comment as comment_confirmed",
      ])
      .orderBy("wso.order_id", "desc")
      .orderBy("wois.id", "asc")
      .stream()

    return listOrder
  }

  async getLocationEntityCustomerByOrderId(
    c: Context<DB>,
    id: number,
    programId: number
  ) {
    return await c.var.trx
      .selectFrom("ws_orders as wso")
      .innerJoin("ws_entities as wse", (join) =>
        join
          .onRef("wse.id", "=", "wso.customer_id")
          .on("wse.program_id", "=", programId)
          .on("wse.deleted_at", "is", null)
      )
      .select([
        "wse.province_id",
        "wse.regency_id",
        "wse.sub_district_id",
        "wse.village_id",
      ])
      .where("wso.id", "=", id)
      .where("wso.deleted_at", "is", null)
      .executeTakeFirst()
  }

  async getLocationUserByWsEntityId(
    c: Context<DB>,
    id: number,
    programId: number
  ) {
    return await c.var.trx
      .selectFrom("ws_entities")
      .select(["province_id", "regency_id", "sub_district_id", "village_id"])
      .where("id", "=", id)
      .where("program_id", "=", programId)
      .where("deleted_at", "is", null)
      .executeTakeFirst()
  }

  async getLocationsAuthorityByEntityLocationId(c: Context<DB>, id: number) {
    return await c.var.trx
      .selectFrom("locations")
      .select(["id"])
      .where((qb) =>
        qb.or([
          qb("id", "=", id),
          qb("parent_id", "=", id),
          qb(
            "parent_id",
            "in",
            c.var.trx
              .selectFrom("locations")
              .select("id")
              .where("parent_id", "=", id)
          ),
          qb(
            "parent_id",
            "in",
            c.var.trx
              .selectFrom("locations")
              .select("id")
              .where(
                "parent_id",
                "in",
                c.var.trx
                  .selectFrom("locations")
                  .select("id")
                  .where("parent_id", "=", id)
              )
          ),
        ])
      )
      .execute()
  }
  async getOrderDetails(c: Context<DB>, id: number, programId: number) {
    return c.var.trx
      .selectFrom("ws_orders as wso")
      .innerJoin("ws_order_audits as wsoa", "wsoa.order_id", "wso.id")
      .innerJoin("ws_activities as wsa", (join) =>
        join
          .onRef("wsa.id", "=", "wso.activity_id")
          .on("wsa.program_id", "=", programId)
          .on("wsa.deleted_at", "is", null)
      )
      .innerJoin("ws_entities as wse_vendor", (join) =>
        join
          .onRef("wse_vendor.id", "=", "wso.vendor_id")
          .on("wse_vendor.program_id", "=", programId)
          .on("wse_vendor.deleted_at", "is", null)
      )
      .innerJoin("ws_entities as wse_customer", (join) =>
        join
          .onRef("wse_customer.id", "=", "wso.customer_id")
          .on("wse_customer.program_id", "=", programId)
          .on("wse_customer.deleted_at", "is", null)
      )
      .leftJoin("ws_users as wsu_created", (join) =>
        join
          .onRef("wsu_created.id", "=", "wso.created_by")
          .on("wsu_created.program_id", "=", programId)
          .on("wsu_created.deleted_by", "is", null)
      )
      .leftJoin("locations as vendor_province", (join) =>
        join.onRef("vendor_province.id", "=", "wse_vendor.province_id")
      )
      .leftJoin("locations as vendor_regency", (join) =>
        join.onRef("vendor_regency.id", "=", "wse_vendor.regency_id")
      )
      .leftJoin("locations as customer_province", (join) =>
        join.onRef("customer_province.id", "=", "wse_customer.province_id")
      )
      .leftJoin("locations as customer_regency", (join) =>
        join.onRef("customer_regency.id", "=", "wse_customer.regency_id")
      )
      .leftJoin("locations as customer_sub_district", (join) =>
        join.onRef(
          "customer_sub_district.id",
          "=",
          "wse_customer.sub_district_id"
        )
      )
      .select([
        "wso.vendor_id",
        "wso.customer_id",
        "wso.activity_id",
        "wso.order_status_id",
        "wso.created_at as created_at_order",
        "wso.order_type_id",
        "wso.order_status_id",
        "wsoa.shipped_at as shipped_at",
        "wsu_created.firstname as firstname",
        "wsu_created.lastname as lastname",
        "wsa.name as activity_name",
        "wse_vendor.name as vendor_name",
        "wse_customer.name as customer_name",
        "vendor_province.name as vendor_province_name",
        "vendor_regency.name as vendor_regency_name",
        "customer_province.name as customer_province_name",
        "customer_regency.name as customer_regency_name",
        "customer_sub_district.name as sub_district_name",
      ])
      .where("wso.id", "=", id)
      .where("wso.deleted_at", "is", null)
      .executeTakeFirst()
  }

  async getOrderItems(c: HonoContext, id: number) {
    const rows = await c.var.trx
      .selectFrom("ws_orders as wso")
      .innerJoin("ws_order_item_stocks as wsois", (join) =>
        join
          .onRef("wsois.order_id", "=", "wso.id")
          .on("wsois.deleted_at", "is", null)
      )
      .leftJoin("ws_entity_material_activities as wema", (join) =>
        join
          .onRef("wema.material_id", "=", "wsois.material_id")
          .onRef("wema.entity_id", "=", "wso.customer_id")
          .onRef("wema.activity_id", "=", "wso.activity_id")
      )
      .leftJoin("ws_order_item_stocks as wsois_child", (join) =>
        join
          .onRef("wsois.material_id", "=", "wsois_child.parent_material_id")
          .on("wsois_child.parent_material_id", "is not", null)
      )
      .leftJoin("ws_stocks as wss", (join) =>
        join
          .onRef("wss.id", "=", "wsois.stock_id")
          .on("wss.deleted_at", "is", null)
      )
      .leftJoin("ws_batches as wsb", (join) =>
        join
          .onRef("wsb.id", "=", "wss.batch_id")
          .on("wsb.deleted_at", "is", null)
      )
      .leftJoin("ws_budget_sources as wsbs", (join) =>
        join
          .onRef("wsbs.id", "=", "wss.budget_source_id")
          .on("wss.deleted_at", "is", null)
      )
      .leftJoin("ws_order_stock_statuses as wsoss", (join) =>
        join
          .onRef("wsoss.id", "=", "wsois.order_stock_status_id")
          .on("wsoss.deleted_at", "is", null)
      )
      .leftJoin("ws_order_stock_statuses as wsoss2", (join) =>
        join
          .onRef("wsoss2.id", "=", "wsois.fulfill_stock_status_id")
          .on("wsoss2.deleted_at", "is", null)
      )
      .leftJoin("ws_materials as wm", "wm.id", "wsois.material_id")
      .leftJoin(
        "ws_materials as wm_child",
        "wm_child.id",
        "wsois_child.material_id"
      )
      .select([
        sql<number>`coalesce(wsois_child.material_id, wsois.material_id)`.as(
          "material_id"
        ),
        sql<string>`coalesce(wm_child.name, wm.name)`.as("material_name"),
        sql<string>`coalesce(wm_child.unit_of_distribution, wm.unit_of_distribution)`.as(
          "unit_of_distribution"
        ),
        sql<number>`coalesce(wm_child.consumption_unit_per_distribution_unit, wm.consumption_unit_per_distribution_unit)`.as(
          "consumption_unit_per_distribution_unit"
        ),
        "wsois_child.material_id as child_material_id",
        "wsois.recommended_stock",
        "wsois.allocated_qty",
        "wsois.ordered_qty",
        "wsois.confirmed_qty",
        "wsois.metadata",
        "wsb.code as code_batch",
        "wsb.expired_date as expired_date_batch",
        "wss.price as price_stock",
        "wsbs.name as budget_source_name",
        "wsoss.name as order_stock_status_name",
        "wsoss2.name as fulfill_stock_status_name",
        "wsois.stock_id",
        "wema.min",
        "wema.max",
      ])
      .where("wso.deleted_at", "is", null)
      .where("wso.id", "=", id)
      .where("wsois.parent_material_id", "is", null)
      .distinct()
      .execute()

    const result = {
      templates: rows.filter((row) => !row.child_material_id),
      variants: rows.filter((row) => row.child_material_id),
    }

    return result
  }

  async getStockCustomerVendorByWsMaterialIds(
    c: Context<DB>,
    entityId: number | null,
    programId: number,
    materialIds: number[],
    materialLevelId: number,
    activityId?: number
  ) {
    return c.var.trx
      .selectFrom("ws_stocks as ws")
      .innerJoin("ws_activities as wa", (join) =>
        join
          .onRef("ws.activity_id", "=", "wa.id")
          .on("wa.program_id", "=", programId)
          .on("wa.deleted_at", "is", null)
      )
      .select([
        "wa.program_id",
        "ws.id as stock_id",
        "ws.activity_id",
        "ws.material_id",
        "ws.entity_id",
        sql`coalesce(sum(ws.qty), 0)`.as("total_qty"),
        sql`coalesce(sum(ws.in_transit_qty), 0)`.as("total_in_transit_qty"),
        sql`coalesce(sum(ws.allocated_qty), 0)`.as("total_allocated_qty"),
        sql`coalesce(sum(ws.qty - ws.allocated_qty), 0)`.as(
          "total_available_qty"
        ),
        sql`coalesce(sum(ws.unreceived_qty), 0)`.as("total_unreceived_qty"),
      ])
      .$if(materialLevelId === KFA_LEVEL_CODE_TO_ID[92], (qb) =>
        qb.select("ws.parent_material_id as material_id")
      )
      .$if(materialLevelId === KFA_LEVEL_CODE_TO_ID[93], (qb) =>
        qb.select("ws.material_id")
      )
      .$if(materialLevelId === KFA_LEVEL_CODE_TO_ID[93], (qb) =>
        qb.select("ws.price")
      )
      .where("ws.entity_id", "=", entityId)
      .$if(materialLevelId === KFA_LEVEL_CODE_TO_ID[92], (b) =>
        b.where("ws.parent_material_id", "in", materialIds)
      )
      .$if(materialLevelId === KFA_LEVEL_CODE_TO_ID[93], (b) =>
        b.where("ws.material_id", "in", materialIds)
      )
      .where("ws.deleted_at", "is", null)
      .$if(materialLevelId === KFA_LEVEL_CODE_TO_ID[92], (qb) =>
        qb.groupBy(["wa.program_id", "ws.entity_id", "ws.parent_material_id"])
      )
      .$if(activityId !== undefined, (qb) =>
        qb.where("ws.activity_id", "=", activityId)
      )
      .$if(materialLevelId === KFA_LEVEL_CODE_TO_ID[93], (qb) =>
        qb.groupBy([
          "wa.program_id",
          "ws.entity_id",
          "ws.material_id",
          "ws.activity_id",
          "ws.price",
        ])
      )
      .execute()
  }

  async getLocationEntityVendorByOrderId(
    c: Context<DB>,
    id: number,
    programId: number
  ) {
    return await c.var.trx
      .selectFrom("ws_orders as wso")
      .innerJoin("ws_entities as wse", (join) =>
        join
          .onRef("wse.id", "=", "wso.vendor_id")
          .on("wse.program_id", "=", programId)
          .on("wse.deleted_at", "is", null)
      )
      .select([
        "wse.province_id",
        "wse.regency_id",
        "wse.sub_district_id",
        "wse.village_id",
      ])
      .where("wso.id", "=", id)
      .where("wso.deleted_at", "is", null)
      .executeTakeFirst()
  }

  async getWsMaterialByMaterialIds(
    c: Context<DB>,
    materialId: number[],
    programId: number
  ) {
    return await c.var.trx
      .selectFrom("ws_materials as wm")
      .selectAll()
      .where("wm.id", "in", materialId)
      .where("wm.program_id", "=", programId)
      .where("deleted_at", "is", null)
      .execute()
  }

  async getMaterialRelationByMaterialId(c: Context<DB>, materialId: number) {
    return await c.var.trx
      .selectFrom("material_relations as mr")
      .selectAll()
      .where("mr.parent_material_id", "=", materialId)
      .where("deleted_at", "is", null)
      .execute()
  }

  async getOrderHistoriesByOrderId(c: Context<DB>, orderId: number) {
    return await c.var.trx
      .selectFrom("ws_order_histories as woh")
      .selectAll()
      .where("woh.order_id", "=", orderId)
      .where("woh.deleted_at", "is", null)
      .execute()
  }

  async getEntityMaterialActivitiesByStocksData(
    c: Context<DB>,
    entityId: number,
    activityId: number,
    materialIds: number[]
  ) {
    return await c.var.trx
      .selectFrom("ws_entity_material_activities as wema")
      .selectAll()
      .where("wema.entity_id", "=", entityId)
      .where("wema.activity_id", "=", activityId)
      .where("wema.material_id", "in", materialIds)
      .where("wema.deleted_at", "is", null)
      .orderBy("wema.updated_at", "desc")
      .execute()
  }

  async getOrderCancelReasonById(c: Context<DB>, id: number) {
    return c.var.trx
      .selectFrom("ws_order_cancel_reasons")
      .select(["id", "name"])
      .where("deleted_at", "is", null)
      .where("id", "=", id)
      .executeTakeFirst()
  }

  async getOrderNotReceived(c: Context<DB>, entityId: number) {
    const orderNotReceived = await c.var.trx
      .selectFrom("ws_orders as wo")
      .innerJoin("ws_order_statuses as was", "was.id", "wo.order_status_id")
      .where((eb) =>
        eb.or([
          eb("wo.customer_id", "=", entityId),
          eb("wo.vendor_id", "=", entityId),
        ])
      )
      .where("wo.activity_id", "is not", null)
      .where("wo.order_status_id", "in", [4])
      .where("wo.order_type_id", "in", [1, 2, 3])
      .select([
        "wo.id as order_id",
        "wo.customer_id as customer_id",
        "wo.vendor_id as vendor_id",
      ])
      .execute()

    return orderNotReceived
  }

  async getLevelAndParentLocationByLocationId(c: Context<DB>, id: number) {
    return await c.var.trx
      .selectFrom("locations")
      .select(["parent_id", "level"])
      .where("id", "=", id)
      .executeTakeFirst()
  }

  async getWsPurchaseByOrderId(
    c: Context,
    orderId: number,
    transactionTypeId: number
  ) {
    return await c.var.trx
      .selectFrom("ws_purchases as wp")
      .innerJoin("ws_transactions as wt", (join) =>
        join.onRef("wp.source_id", "=", "wt.id").on("wt.deleted_at", "is", null)
      )
      .select([
        "wp.id as purchase_id",
        "wt.id as transaction_id",
        "wt.change_qty",
        "wt.stock_id",
        "wp.price",
        "wp.total_price",
        "wp.budget_source_id",
        "wp.year",
      ])
      .where("wt.order_id", "=", orderId)
      .where("wp.source_type", "=", "transaction")
      .where("wp.deleted_at", "is", null)
      .where("wt.transaction_type_id", "=", transactionTypeId)
      .execute()
  }

  async getReport(
    c: Context,
    orderId: number,
    transactionTypeId: number,
    levelMaterialIds: number[],
    entityId: number,
    programId: number
  ) {
    const result = await c.var.trx
      .selectFrom("ws_order_item_stocks as items")
      .leftJoin("ws_materials as material", (join) =>
        join
          .onRef("material.id", "=", "items.material_id")
          .on("material.deleted_at", "is", null)
          .on((eb) => eb("material.material_level_id", "in", levelMaterialIds))
      )
      .leftJoin("ws_stocks as stocks", (join) =>
        join
          .onRef("stocks.id", "=", "items.stock_id")
          .on("stocks.deleted_at", "is", null)
      )
      .leftJoin("ws_batches as batch", (join) =>
        join
          .onRef("batch.id", "=", "stocks.batch_id")
          .on("batch.deleted_at", "is", null)
      )
      .leftJoin("ws_orders as main", (join) =>
        join
          .onRef("main.id", "=", "items.order_id")
          .on("main.deleted_at", "is", null)
          .on("main.id", "=", orderId)
      )
      .leftJoin("ws_entities as entity", (join) =>
        join
          .on("entity.id", "=", entityId)
          .on("entity.deleted_at", "is", null)
          .on("entity.program_id", "=", programId)
      )
      .leftJoin("ws_transactions as transaction", (join) =>
        join
          .onRef("transaction.stock_id", "=", "items.stock_id")
          .on("transaction.deleted_at", "is", null)
          .on("transaction.order_id", "=", orderId)
      )
      .leftJoin("ws_transaction_types as type", (join) =>
        join
          .onRef("type.id", "=", "transaction.transaction_type_id")
          .on("type.deleted_at", "is", null)
      )
      .leftJoin("ws_activities as activity", (join) =>
        join
          .onRef("activity.id", "=", "transaction.activity_id")
          .on("activity.deleted_at", "is", null)
      )
      .leftJoin("ws_purchases as purchase", (join) =>
        join
          .onRef("purchase.source_id", "=", "transaction.id")
          .on("purchase.deleted_at", "is", null)
      )
      .leftJoin("ws_order_stock_statuses as stock_statuses", (join) =>
        join.onRef("stock_statuses.id", "=", "items.order_stock_status_id")
      )
      .where("items.order_id", "=", orderId)
      .where("items.deleted_at", "is", null)
      .where((eb) =>
        eb.or([
          eb("transaction.transaction_type_id", "=", transactionTypeId),
          eb("transaction.transaction_type_id", "is", null),
        ])
      )
      .select([
        "stocks.id as stock_id",
        "purchase.id as purchase_id",
        "entity.name as entity_name",
        "material.name as material_name",
        "material.material_level_id",
        "material.unit_of_distribution",
        "material.unit_of_consumption",
        "material.consumption_unit_per_distribution_unit",
        "items.parent_material_id",
        "items.material_id",
        "transaction.activity_id",
        "activity.name as activity_name",
        "items.order_reason_id",
        "items.stock_id",
        sql<string>`COALESCE(batch.code, '-')`.as("code_batch"),
        "batch.expired_date as expired_date_batch",
        "items.qty",
        "items.ordered_qty",
        "items.confirmed_qty",
        "items.allocated_qty",
        "purchase.price",
        "purchase.total_price",
        sql<number>`(
        SELECT SUM(ws.qty)
        FROM ws_stocks ws
        WHERE ws.deleted_at IS NULL
          AND ws.entity_id = ${entityId}
          AND ws.parent_material_id = COALESCE(material.parent_id, material.id)
      )`.as("stock_on_hand"),
        sql<number>`(
        SELECT SUM(ws.qty - ws.allocated_qty)
        FROM ws_stocks ws
        WHERE ws.deleted_at IS NULL
          AND ws.entity_id = ${entityId}
          AND ws.parent_material_id = COALESCE(material.parent_id, material.id)
      )`.as("total_available_qty"),
        "transaction.transaction_type_id",
        "type.title",
        "transaction.opening_qty",
        "transaction.change_qty",
        "stocks.in_transit_qty",
        sql<number>`SUM(items.received_qty)`.as("total_received_qty"),
        "stock_statuses.name as order_stock_status_name",
        "purchase.budget_source_id",
        "stocks.price as stock_price",
        "stocks.year",
      ])
      .groupBy([
        sql<string>`CASE WHEN purchase.id IS NOT NULL THEN CAST(purchase.id AS CHAR) ELSE CONCAT('null_', items.id) END`,
        "stocks.id",
        "stocks.id",
        "entity.name",
        "material.name",
        "material.material_level_id",
        "items.parent_material_id",
        "items.material_id",
        "transaction.activity_id",
        "activity.name",
        "items.order_reason_id",
        "items.stock_id",
        "batch.code",
        "batch.expired_date",
        "purchase.price",
        "purchase.total_price",
        "transaction.transaction_type_id",
        "type.title",
        "transaction.opening_qty",
        "transaction.change_qty",
        "stocks.in_transit_qty",
        "stock_statuses.name",
      ])
      .execute()

    return result
  }

  async getBudgetSources(c: Context<DB>, ids: number[], programId: number) {
    return c.var.trx
      .selectFrom("ws_budget_sources")
      .select(["id", "name"])
      .where("id", "in", ids)
      .where("program_id", "=", programId)
      .where("deleted_at", "is", null)
      .execute()
  }

  public getIntegrationLogsByOrderId = async (
    c: Context<DB>,
    orderId: number,
    page: number,
    limit: number
  ) => {
    const offset = (page - 1) * limit

    const [rows, total] = await Promise.all([
      c.var.trx
        .selectFrom("integration_logs as l")
        .leftJoin("integration_clients as c", "l.client_id", "c.id")
        .select([
          "l.id",
          "l.flow",
          "l.tag",
          "l.request",
          "l.response",
          "l.created_at",
          "c.name as client_name",
        ])
        .where("source_id", "=", orderId)
        .where("source_type", "=", "order")
        .limit(limit)
        .offset(offset)
        .orderBy("created_at", "desc")
        .execute(),

      c.var.trx
        .selectFrom("integration_logs")
        .where("source_id", "=", orderId)
        .where("source_type", "=", "order")
        .select(({ fn }) => fn.count<number>("source_id").as("total"))
        .executeTakeFirst()
        .then((row) => Number(row?.total ?? 0)),
    ])

    const data = rows.map((row) => ({
      action: c.var.t(`order.tag.${row.tag}`),
      source: row.flow === "in" ? row.client_name : "SMILE",
      target: row.flow === "in" ? "SMILE" : row.client_name,
      ...pick(row, ["request", "response", "created_at", "id"]),
    }))

    return { data, total }
  }

  async getIntegrationLogFlowOut(
    c: Context<DB>,
    id: number,
    programId: number
  ) {
    return await c.var.trx
      .selectFrom("integration_logs as l")
      .innerJoin("integration_clients as c", "l.client_id", "c.id")
      .innerJoin("ws_order_lists as o", "l.source_id", "o.order_id")
      .select(["c.key as client_key", "o.order_id", "o.program_id"])
      .selectAll("l")
      .where("l.id", "=", id)
      .where("o.program_id", "=", programId)
      .where("l.flow", "=", "out")
      .executeTakeFirst()
  }

  async createOtherReason(c: Context<DB>, req) {
    return await c.var.trx
      .insertInto("ws_other_reasons")
      .values(req)
      .executeTakeFirst()
  }
}
