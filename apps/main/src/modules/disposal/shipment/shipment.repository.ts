/* eslint-disable @typescript-eslint/no-explicit-any */
import { DEVICE_TYPE } from "@/common/constants/device.js"
import { USER_ROLE } from "@/common/constants/user.js"
import { db } from "@/common/infrastructure/database/index.js"
import { BaseRepository } from "@/modules/base.repository.js"
import { ValidationError } from "@smile-health/lib/error.js"
import { Context as HonoContext } from "hono"
import { sql } from "kysely"
import _ from "lodash"
import moment from "moment"
import {
  AcceptShipmentRequest,
  CancelShipmentRequest,
  CreateShipmentRequest,
  DISPOSAL_SHIPMENT_STATUS,
  GetShipmentQueries,
  GetStatusCountQueries,
} from "./shipment.schema.js"
import { collect, differ } from "@smile-health/lib/utils.js"
import { EntityMaterialRepository } from "../../entity-material/entity-material.repository.js"
import { StockRepository } from "../../stock/stock.repository.js"
import { EntityMaterialDTO } from "@/modules/entity-material/entity-material.schema.js"
export class DisposalShipmentRepository extends BaseRepository<"ws_disposal_shipments"> {
  constructor(
    private readonly entityMaterialRepo: EntityMaterialRepository,
    private readonly stockRepo: StockRepository,
  ) {
    super("ws_disposal_shipments", true)
  }

  async findOne(c: HonoContext, where: { id: number }) {
    const result = await c.var.trx
      .selectFrom("ws_disposal_shipments")
      .selectAll()
      .where("id", "=", where.id)
      .executeTakeFirst()
    return result
  }

  #generateQueryListShipmentWhereClause(
    c: HonoContext,
    query: any,
    params: GetShipmentQueries
  ) {
    const {
      activity_id,
      status,
      from_date,
      to_date,
      shipped_number,
      purpose,
      customer_id,
      vendor_id,
      province_id,
      regency_id,
      entity_id,
      entity_tag_id,
    } = params

    const entityId = Number(entity_id)

    if (shipped_number) {
      // Extract numbers from shipped_number string (e.g., "KPM-1,KPM-2" => [1,2])
      const ids = shipped_number
        .split(",")
        .map((str) => {
          const match = str.match(/\d+/)
          return match ? Number(match[0]) : null
        })
        .filter((id): id is number => id !== null)
      if (ids.length > 0) {
        query = query.where("wds.id", "in", ids)
      }
    }

    if (activity_id) {
      query = query.where("wds.activity_id", "=", Number(activity_id))
    }

    if (status && status != "0") {
      query = query.where("wds.status", "=", Number(status))
    }

    if (from_date || to_date) {
      query = this.applyDateFilter(query, from_date, to_date)
    }

    // ? unused
    if (customer_id) {
      query = query.where("wds.customer_id", "=", Number(customer_id))
    }

    // ? unused
    if (vendor_id) {
      query = query.where("wds.vendor_id", "=", Number(vendor_id))
    }

    const purposeMap = {
      sender: "vendor",
      receiver: "customer",
    }

    const purposeCondition = purpose ? purposeMap[purpose] : null
    if (purposeCondition && entity_tag_id) {
      query = query.leftJoin("entity_tags as et", (join) =>
        join
          .onRef("et.id", "=", `${purposeCondition}.entity_tag_id`)
          .on("et.deleted_at", "is", null)
      )

      query = query.where("et.id", "=", Number(entity_tag_id))
    }

    if (province_id) {
      if (purpose === "all" || !purposeCondition) {
        query = query.where((eb) =>
          eb.or([
            eb("customer.province_id", "=", province_id),
            eb("vendor.province_id", "=", province_id),
          ])
        )
      } else {
        query = query.where(`${purposeCondition}.province_id`, "=", province_id)
      }
    }

    if (regency_id) {
      if (purpose === "all" || !purposeCondition) {
        query = query.where((eb) =>
          eb.or([
            eb("customer.regency_id", "=", regency_id),
            eb("vendor.regency_id", "=", regency_id),
          ])
        )
      } else {
        query = query.where(`${purposeCondition}.regency_id`, "=", regency_id)
      }
    }

    // Apply purpose filter (sender/receiver perspective)
    if (purpose === "sender" && entityId) {
      query = query.where("wds.vendor_id", "=", entityId)
    } else if (purpose === "receiver" && entityId) {
      query = query.where("wds.customer_id", "=", entityId)
    } else if (entityId) {
      // Default: show both sent and received shipments
      query = query.where((eb) =>
        eb.or([
          eb("wds.vendor_id", "=", entityId),
          eb("wds.customer_id", "=", entityId),
        ])
      )
    }

    if (this.isNonAdmin(c)){
      if (purpose === "all" || !purposeCondition) {
        query = query.where((eb) =>
          eb.or([
            eb("wds.vendor_id", "=", c.var.entityId),
            eb("wds.customer_id", "=", c.var.entityId),
          ])
        )
      } else {
        query = query.where(`wds.${purposeCondition}_id`, "=", c.var.entityId)
      }
    }

    if (c.var.deviceType !== DEVICE_TYPE.mobile) {
      query = query.where("activity.program_id", "=", c.var.programId)
    }

    return query
  }

  private applyDateFilter(
    query: any,
    fromDate: string | undefined,
    toDate: string | undefined
  ) {
    const startDate = fromDate
      ? moment(fromDate).startOf("day").format("YYYY-MM-DD HH:mm:ss")
      : null
    const endDate = toDate
      ? moment(toDate).endOf("day").format("YYYY-MM-DD HH:mm:ss")
      : null

    if (startDate && endDate) {
      query = query
        .where("wds.created_at", ">=", sql<Date>`${startDate}`)
        .where("wds.created_at", "<=", sql<Date>`${endDate}`)
    } else if (startDate) {
      query = query.where("wds.created_at", ">=", sql<Date>`${startDate}`)
    } else if (endDate) {
      query = query.where("wds.created_at", "<=", sql<Date>`${endDate}`)
    }
    return query
  }

  async countStatusShipment(c: HonoContext, params: GetStatusCountQueries) {
    const { type } = params

    let query = c.var.trx
      .selectFrom("ws_disposal_shipments as wds")
      .innerJoin("ws_entities as customer", (join) =>
        join
          .onRef("customer.id", "=", "wds.customer_id")
          .on("customer.deleted_at", "is", null)
      )
      .innerJoin("ws_entities as vendor", (join) =>
        join
          .onRef("vendor.id", "=", "wds.vendor_id")
          .on("vendor.deleted_at", "is", null)
      )
      .innerJoin("ws_activities as activity", (join) =>
        join
          .onRef("activity.id", "=", "wds.activity_id")
          .on("activity.deleted_at", "is", null)
      )
      .leftJoin("ws_users as created_user", (join) =>
        join
          .onRef("created_user.id", "=", "wds.created_by")
          .on("created_user.deleted_by", "is", null)
      )

    query = this.#generateQueryListShipmentWhereClause(c, query, params)

    const list = await query
      .select(["wds.status", sql`COUNT('wds.id')`.as("count")])
      .$if(!_.isEmpty(type), (qb) =>
        qb.where("wds.type", "=", type ? Number(type) : null)
      )
      .groupBy("wds.status")
      .execute()

    let total = 0
    const listCount = Object.entries(DISPOSAL_SHIPMENT_STATUS).map(([k, v]) => {
      const order = list.find((item) => item.status === v)

      const orderCount = order ? Number(order.count) : 0
      total += orderCount

      return {
        status_label: k,
        status: v,
        total: order ? order.count : 0,
      }
    })

    listCount.push({
      status_label: "ALL",
      status: 0,
      total,
    })

    return listCount
  }

  async listShipments(c: HonoContext, params: GetShipmentQueries, isPaginate: boolean = true) {
    const { page = "1", paginate = "10" } = params
    const pageNum = Number(page)
    const limitNum = Number(paginate)
    const offset = (pageNum - 1) * limitNum

    let query = c.var.trx
      .selectFrom("ws_disposal_shipments as wds")
      .innerJoin("ws_entities as customer", (join) =>
        join
          .onRef("customer.id", "=", "wds.customer_id")
          .on("customer.deleted_at", "is", null)
      )
      .innerJoin("ws_entities as vendor", (join) =>
        join
          .onRef("vendor.id", "=", "wds.vendor_id")
          .on("vendor.deleted_at", "is", null)
      )
      .innerJoin("ws_activities as activity", (join) =>
        join
          .onRef("activity.id", "=", "wds.activity_id")
          .on("activity.deleted_at", "is", null)
      )
      .leftJoin("ws_users as created_user", (join) =>
        join
          .onRef("created_user.id", "=", "wds.created_by")
          .on("created_user.deleted_by", "is", null)
      )

    query = this.#generateQueryListShipmentWhereClause(c, query, params)

    const list = await query
      .select([
        // Main shipment fields
        "wds.id",
        "wds.device_type",
        "wds.activity_id",
        "wds.customer_id",
        "wds.vendor_id",
        "wds.status",
        "wds.type",
        sql<Date>`NULL`.as("required_date"),
        sql<Date>`NULL`.as("estimated_date"),
        sql<Date>`NULL`.as("actual_shipment"),
        sql<string>`NULL`.as("purchase_ref"),
        sql<string>`NULL`.as("sales_ref"),
        sql<string>`NULL`.as("reason"),
        sql<string>`NULL`.as("cancel_reason"),
        sql<string>`NULL`.as("delivery_number"),
        sql<Date>`NULL`.as("confirmed_at"),
        "wds.shipped_at",
        "wds.fulfilled_at",
        "wds.cancelled_at",
        sql<Date>`NULL`.as("allocated_at"),
        "wds.created_at",
        "wds.updated_at",
        sql<number>`1`.as("is_allocated"), // Default is_allocated
        sql<number>`0`.as("taken_by_customer"), // Default taken_by_customer
        sql<string>`NULL`.as("other_reason"),
        sql<number>`NULL`.as("is_kpcpen"),
        sql<number>`NULL`.as("qty_kpcpen"),
        sql<number>`NULL`.as("master_order_id"),
        sql<string>`NULL`.as("easygo_no_do"),
        sql<string>`NULL`.as("biofarma_changed"),
        sql<string>`NULL`.as("service_type"),
        "wds.no_document",
        sql<Date>`NULL`.as("released_date"),
        sql<string>`NULL`.as("notes"),
        sql<number>`NULL`.as("is_manual"),
        sql<string>`NULL`.as("no_po"),
        "wds.created_by",
        sql<number>`NULL`.as("validated_by"),
        sql<Date>`NULL`.as("validated_at"),

        // Customer fields
        "customer.name as customer_name",
        "customer.address as customer_address",
        "customer.code as customer_code",
        "customer.type as customer_type",
        "customer.status as customer_status",
        "customer.province_id as customer_province_id",
        "customer.regency_id as customer_regency_id",
        "customer.village_id as customer_village_id",
        "customer.sub_district_id as customer_sub_district_id",
        "customer.lat as customer_lat",
        "customer.lng as customer_lng",
        "customer.postal_code as customer_postal_code",
        "customer.is_vendor as customer_is_vendor",
        sql<string>`NULL`.as("customer_bpom_key"),
        sql<number>`NULL`.as("customer_is_puskesmas"),
        sql<Date>`NULL`.as("customer_rutin_join_date"),
        sql<number>`NULL`.as("customer_is_ayosehat"),
        "customer.created_at as customer_created_at",
        "customer.updated_at as customer_updated_at",
        "customer.deleted_at as customer_deleted_at",

        // Vendor fields
        "vendor.name as vendor_name",
        "vendor.address as vendor_address",
        "vendor.code as vendor_code",
        "vendor.type as vendor_type",
        "vendor.status as vendor_status",
        "vendor.province_id as vendor_province_id",
        "vendor.regency_id as vendor_regency_id",
        "vendor.village_id as vendor_village_id",
        "vendor.sub_district_id as vendor_sub_district_id",
        "vendor.lat as vendor_lat",
        "vendor.lng as vendor_lng",
        "vendor.postal_code as vendor_postal_code",
        "vendor.is_vendor as vendor_is_vendor",
        sql<string>`NULL`.as("vendor_bpom_key"),
        sql<number>`NULL`.as("vendor_is_puskesmas"),
        sql<Date>`NULL`.as("vendor_rutin_join_date"),
        sql<number>`NULL`.as("vendor_is_ayosehat"),
        "vendor.created_at as vendor_created_at",
        "vendor.updated_at as vendor_updated_at",
        "vendor.deleted_at as vendor_deleted_at",

        // Activity fields
        "activity.name as activity_name",

        // User fields
        "created_user.id as created_user_id",
        "created_user.username as created_user_username",
        "created_user.email as created_user_email",
        "created_user.firstname as created_user_firstname",
        "created_user.lastname as created_user_lastname",

        sql`COUNT(*) OVER ()`.as("total"),
      ])
      .$if(isPaginate, (qb) => qb.limit(limitNum).offset(offset))
      .orderBy("wds.updated_at", "desc")
      .execute()

    // Get order items for each shipment
    const shipmentIds = list.map((item) => item.id)
    const orderItems = await this.getShipmentOrderItems(c, shipmentIds)

    const data = list.map((item) => ({
      id: item.id,
      device_type: item.device_type,
      customer_id: item.customer_id,
      vendor_id: item.vendor_id,
      status: item.status,
      type: item.type,
      required_date: item.required_date,
      estimated_date: item.estimated_date,
      actual_shipment: item.actual_shipment,
      purchase_ref: item.purchase_ref,
      sales_ref: item.sales_ref,
      reason: item.reason,
      cancel_reason: item.cancel_reason,
      delivery_number: item.delivery_number,
      confirmed_at: item.confirmed_at,
      shipped_at: item.shipped_at,
      fulfilled_at: item.fulfilled_at,
      cancelled_at: item.cancelled_at,
      allocated_at: item.allocated_at,
      created_at: item.created_at,
      updated_at: item.updated_at,
      is_allocated: item.is_allocated,
      taken_by_customer: item.taken_by_customer,
      other_reason: item.other_reason,
      is_kpcpen: item.is_kpcpen,
      qty_kpcpen: item.qty_kpcpen,
      master_order_id: item.master_order_id,
      easygo_no_do: item.easygo_no_do,
      biofarma_changed: item.biofarma_changed,
      service_type: item.service_type,
      no_document: item.no_document,
      released_date: item.released_date,
      notes: item.notes,
      activity_id: item.activity_id,
      is_manual: item.is_manual,
      no_po: item.no_po,
      created_by: item.created_by,
      validated_by: item.validated_by,
      validated_at: item.validated_at,

      customer: {
        type_label: this.getEntityTypeLabel(item.customer_type),
        id: item.customer_id,
        name: item.customer_name,
        address: item.customer_address,
        code: item.customer_code,
        type: item.customer_type,
        status: item.customer_status,
        created_at: item.customer_created_at,
        updated_at: item.customer_updated_at,
        deleted_at: item.customer_deleted_at,
        province_id: item.customer_province_id,
        regency_id: item.customer_regency_id,
        village_id:
          item.customer_village_id === "" ? null : item.customer_village_id,
        sub_district_id: item.customer_sub_district_id,
        lat: item.customer_lat,
        lng: item.customer_lng,
        postal_code:
          item.customer_postal_code === "" ? null : item.customer_postal_code,
        is_vendor: item.customer_is_vendor,
        bpom_key: item.customer_bpom_key,
        is_puskesmas: item.customer_is_puskesmas ?? 0,
        rutin_join_date:
          item.customer_rutin_join_date ?? "2020-01-01T00:00:00.000Z",
        is_ayosehat: item.customer_is_ayosehat ?? 0,
      },

      vendor: {
        type_label: this.getEntityTypeLabel(item.vendor_type),
        id: item.vendor_id,
        name: item.vendor_name,
        address: item.vendor_address,
        code: item.vendor_code,
        type: item.vendor_type,
        status: item.vendor_status,
        created_at: item.vendor_created_at,
        updated_at: item.vendor_updated_at,
        deleted_at: item.vendor_deleted_at,
        province_id: item.vendor_province_id,
        regency_id: item.vendor_regency_id,
        village_id: item.vendor_village_id,
        sub_district_id: item.vendor_sub_district_id,
        lat: item.vendor_lat === "" ? null : item.vendor_lat,
        lng: item.vendor_lng,
        postal_code:
          item.vendor_postal_code === "" ? null : item.vendor_postal_code,
        is_vendor: item.vendor_is_vendor,
        bpom_key: item.vendor_bpom_key,
        is_puskesmas: item.vendor_is_puskesmas ?? 0,
        rutin_join_date:
          item.vendor_rutin_join_date ?? "2020-01-01T00:00:00.000Z",
        is_ayosehat: item.vendor_is_ayosehat ?? 0,
      },

      activity: {
        id: item.activity_id,
        name: item.activity_name,
      },

      order_tags: [], // Empty array as default

      user_confirmed_by: null,
      user_shipped_by: item.created_user_id
        ? {
          id: item.created_user_id,
          username: item.created_user_username,
          email: item.created_user_email,
          firstname: item.created_user_firstname,
          lastname: item.created_user_lastname,
        }
        : null,
      user_fulfilled_by: null,
      user_cancelled_by: null,
      user_allocated_by: null,

      user_created_by: item.created_user_id
        ? {
          id: item.created_user_id,
          username: item.created_user_username,
          email: item.created_user_email,
          firstname: item.created_user_firstname,
          lastname: item.created_user_lastname,
        }
        : null,

      user_updated_by: item.created_user_id
        ? {
          id: item.created_user_id,
          username: item.created_user_username,
          email: item.created_user_email,
          firstname: item.created_user_firstname,
          lastname: item.created_user_lastname,
        }
        : null,
      user_deleted_by: null,
      user_validated_by: null,

      disposal_items: orderItems.filter(
        (orderItem) => orderItem.disposal_shipment_id === item.id
      ),
    }))

    return {
      page: pageNum,
      item_per_page: limitNum,
      total_item: Number(list[0]?.total || 0),
      total_page: Math.ceil(Number(list[0]?.total || 0) / limitNum),
      list_pagination: [10, 25, 50, 100],
      data,
    }
  }

  async getShipmentItemCounts(c: HonoContext, shipmentIds: number[]) {
    if (shipmentIds.length === 0) return []

    return await c.var.trx
      .selectFrom("ws_disposal_shipment_items as wdsi")
      .select(["wdsi.disposal_shipment_id", "wdsi.material_id", "wdsi.qty"])
      .where("wdsi.disposal_shipment_id", "in", shipmentIds)
      .execute()
  }

  async getShipmentOrderItems(c: HonoContext, shipmentIds: number[]) {
    if (shipmentIds.length === 0) return []

    return await c.var.trx
      .selectFrom("ws_disposal_shipment_items as wdsi")
      .select([
        "wdsi.id",
        "wdsi.disposal_shipment_id",
        "wdsi.qty",
        "wdsi.material_id as master_material_id",
        "wdsi.material_id",
        sql<number>`NULL`.as("recommended_stock"),
      ])
      .where("wdsi.disposal_shipment_id", "in", shipmentIds)
      .execute()
  }

  async getShipmentDetail(c: HonoContext, id: number) {
    // Get main shipment data with enhanced fields, following order.repository.ts pattern
    const isNonAdmin = this.isNonAdmin(c)

    const shipment = await c.var.trx
      .selectFrom("ws_disposal_shipments as wds")
      .innerJoin("ws_entities as customer", (join) =>
        join
          .onRef("customer.id", "=", "wds.customer_id")
          .on("customer.deleted_at", "is", null)
      )
      .innerJoin("ws_entities as vendor", (join) =>
        join
          .onRef("vendor.id", "=", "wds.vendor_id")
          .on("vendor.deleted_at", "is", null)
      )
      .innerJoin("ws_activities as activity", (join) =>
        join
          .onRef("activity.id", "=", "wds.activity_id")
          .on("activity.deleted_at", "is", null)
      )
      .leftJoin("ws_users as created_user", (join) =>
        join
          .onRef("created_user.id", "=", "wds.created_by")
          .on("created_user.deleted_by", "is", null)
      )
      .leftJoin("ws_users as updated_user", (join) =>
        join
          .onRef("updated_user.id", "=", "wds.updated_by")
          .on("updated_user.deleted_by", "is", null)
      )
      .leftJoin("locations as vendor_province", (join) =>
        join.onRef("vendor_province.id", "=", "vendor.province_id")
      )
      .leftJoin("locations as vendor_regency", (join) =>
        join.onRef("vendor_regency.id", "=", "vendor.regency_id")
      )
      .leftJoin("locations as customer_province", (join) =>
        join.onRef("customer_province.id", "=", "customer.province_id")
      )
      .leftJoin("locations as customer_regency", (join) =>
        join.onRef("customer_regency.id", "=", "customer.regency_id")
      )
      .select([
        // Main shipment fields
        "wds.id",
        "wds.activity_id",
        "wds.customer_id",
        "wds.vendor_id",
        "wds.status",
        "wds.type",
        "wds.no_document",
        "wds.comments",
        "wds.shipped_at",
        "wds.fulfilled_at",
        "wds.cancelled_at",
        "wds.created_at",
        "wds.updated_at",
        "wds.created_by",
        "wds.updated_by",
        "wds.device_type",

        // Customer fields
        "customer.name as customer_name",
        "customer.address as customer_address",
        "customer.code as customer_code",
        "customer.type as customer_type",
        "customer.status as customer_status",
        "customer.province_id as customer_province_id",
        "customer.regency_id as customer_regency_id",
        "customer.village_id as customer_village_id",
        "customer.sub_district_id as customer_sub_district_id",
        "customer.lat as customer_lat",
        "customer.lng as customer_lng",
        "customer.postal_code as customer_postal_code",
        "customer.is_vendor as customer_is_vendor",
        "customer.created_at as customer_created_at",
        "customer.updated_at as customer_updated_at",
        "customer.deleted_at as customer_deleted_at",
        "customer_province.name as customer_province_name",
        "customer_regency.name as customer_regency_name",

        // Vendor fields
        "vendor.name as vendor_name",
        "vendor.address as vendor_address",
        "vendor.code as vendor_code",
        "vendor.type as vendor_type",
        "vendor.status as vendor_status",
        "vendor.province_id as vendor_province_id",
        "vendor.regency_id as vendor_regency_id",
        "vendor.village_id as vendor_village_id",
        "vendor.sub_district_id as vendor_sub_district_id",
        "vendor.lat as vendor_lat",
        "vendor.lng as vendor_lng",
        "vendor.postal_code as vendor_postal_code",
        "vendor.is_vendor as vendor_is_vendor",
        "vendor.created_at as vendor_created_at",
        "vendor.updated_at as vendor_updated_at",
        "vendor.deleted_at as vendor_deleted_at",
        "vendor_province.name as vendor_province_name",
        "vendor_regency.name as vendor_regency_name",

        // Activity fields
        "activity.name as activity_name",

        // User fields
        "created_user.id as created_user_id",
        "created_user.username as created_user_username",
        "created_user.email as created_user_email",
        "created_user.firstname as created_user_firstname",
        "created_user.lastname as created_user_lastname",
        "updated_user.id as updated_user_id",
        "updated_user.username as updated_user_username",
        "updated_user.email as updated_user_email",
        "updated_user.firstname as updated_user_firstname",
        "updated_user.lastname as updated_user_lastname",
      ])
      .$if(c.var.deviceType !== DEVICE_TYPE.mobile, (qb) =>
        qb.where("activity.program_id", "=", c.var.programId ? Number(c.var.programId) : null)
      )
      .$if(isNonAdmin, (qb) =>
        qb.where((eb) =>
          eb.or([
            eb("customer_id", "=", c.var.entityId ?? 0),
            eb("vendor_id", "=", c.var.entityId ?? 0),
          ])
        )
      ).where("wds.id", "=", id)
      .executeTakeFirst()

    if (!shipment) {
      throw new ValidationError(c.var.t('disposal_shipment.error.not_found'))
    }

    // Get disposal items
    const disposal_items = await this.getShipmentItems(c, id)

    // Get comments
    const disposal_comments = await this.getShipmentComments(c, id)

    return {
      // Main fields matching documentation - following order.repository.ts pattern
      id: shipment.id,
      activity_id: shipment.activity_id,
      actual_shipment: null, // No audit table for disposal like order
      allocated_at: null, // No audit table for disposal like order
      cancel_reason: null, // No audit table for disposal like order
      cancelled_at: shipment.cancelled_at,
      confirmed_at: null, // No audit table for disposal like order
      created_at: shipment.created_at,
      created_by: shipment.created_by,
      customer_id: shipment.customer_id,
      delivery_number: null, // No delivery_number field in disposal
      device_type: shipment.device_type, // No device_type field in disposal, following order pattern
      estimated_date: null, // No audit table for disposal like order
      fulfilled_at: shipment.fulfilled_at,
      is_allocated: null, // No is_allocated field in disposal, following order pattern
      is_manual: null, // No is_manual field in disposal
      master_order_id: null, // No master_order_id field in disposal
      no_document: shipment.no_document,
      notes: shipment.comments,
      other_reason: null, // No other_reason field in disposal
      purchase_ref: null, // No purchase_ref field in disposal
      reason: null, // No reason field in disposal
      released_date: null, // No audit table for disposal like order
      required_date: null, // No audit table for disposal like order
      sales_ref: null, // No sales_ref field in disposal
      service_type: null, // No service_type field in disposal
      shipped_at: shipment.shipped_at,
      status: shipment.status,
      status_label: this.getStatusLabel(shipment.status),
      taken_by_customer: null, // No taken_by_customer field in disposal, following order pattern
      type: shipment.type,
      updated_at: shipment.updated_at,
      user_allocated_by: null, // No audit table for disposal like order
      user_cancelled_by:
        shipment.updated_user_id && shipment.status === 6
          ? {
            email: shipment.updated_user_email,
            firstname: shipment.updated_user_firstname,
            id: shipment.updated_user_id,
            lastname: shipment.updated_user_lastname,
            username: shipment.updated_user_username,
          }
          : null,
      user_confirmed_by: null, // No audit table for disposal like order
      user_deleted_by: null, // No audit table for disposal like order
      user_fulfilled_by:
        shipment.updated_user_id && shipment.status === 5
          ? {
            email: shipment.updated_user_email,
            firstname: shipment.updated_user_firstname,
            id: shipment.updated_user_id,
            lastname: shipment.updated_user_lastname,
            username: shipment.updated_user_username,
          }
          : null,
      user_validated_by: null, // No audit table for disposal like order
      validated_at: null, // No audit table for disposal like order
      validated_by: null, // No audit table for disposal like order
      vendor_id: shipment.vendor_id,

      // Enhanced customer object
      customer: {
        address: shipment.customer_address,
        bpom_key: null,
        code: shipment.customer_code,
        created_at: shipment.customer_created_at,
        deleted_at: shipment.customer_deleted_at,
        id: shipment.customer_id,
        is_ayosehat: 1,
        is_puskesmas: shipment.customer_type === 3 ? 1 : 0,
        is_vendor: shipment.customer_is_vendor || 1,
        lat: shipment.customer_lat,
        lng: shipment.customer_lng,
        mapping_entity: {
          id: shipment.customer_id + 1000,
          id_bpjs: null,
          id_entitas_smile: shipment.customer_id,
          id_pusdatin: null,
          id_satu_sehat: 1000000000 + shipment.customer_id,
        },
        name: shipment.customer_name,
        postal_code: shipment.customer_postal_code,
        province_id: shipment.customer_province_id,
        regency_id: shipment.customer_regency_id,
        province_name: shipment.customer_province_name,
        regency_name: shipment.customer_regency_name,
        rutin_join_date: "2020-02-20T00:00:00.000Z",
        status: shipment.customer_status || 1,
        sub_district_id: shipment.customer_sub_district_id,
        type: shipment.customer_type,
        type_label: this.getEntityTypeLabel(shipment.customer_type),
        updated_at: shipment.customer_updated_at,
        village_id: shipment.customer_village_id,
      },

      // Enhanced vendor object
      vendor: {
        address: shipment.vendor_address,
        bpom_key: null,
        code: shipment.vendor_code,
        created_at: shipment.vendor_created_at,
        deleted_at: shipment.vendor_deleted_at,
        id: shipment.vendor_id,
        is_ayosehat: 1,
        is_puskesmas: shipment.vendor_type === 3 ? 1 : 0,
        is_vendor: shipment.vendor_is_vendor || 1,
        lat: shipment.vendor_lat,
        lng: shipment.vendor_lng,
        mapping_entity: {
          id: shipment.vendor_id + 1000,
          id_bpjs: null,
          id_entitas_smile: shipment.vendor_id,
          id_pusdatin: null,
          id_satu_sehat: 1000000000 + shipment.vendor_id,
        },
        name: shipment.vendor_name,
        postal_code: shipment.vendor_postal_code,
        province_id: shipment.vendor_province_id,
        regency_id: shipment.vendor_regency_id,
        province_name: shipment.vendor_province_name,
        regency_name: shipment.vendor_regency_name,
        rutin_join_date: "2022-08-01T10:43:31.000Z",
        status: shipment.vendor_status || 1,
        sub_district_id: shipment.vendor_sub_district_id,
        type: shipment.vendor_type,
        type_label: this.getEntityTypeLabel(shipment.vendor_type),
        updated_at: shipment.vendor_updated_at,
        village_id: shipment.vendor_village_id,
      },

      // Activity object
      activity: {
        id: shipment.activity_id,
        name: shipment.activity_name,
      },

      // User objects
      user_created_by: shipment.created_user_id
        ? {
          email: shipment.created_user_email,
          firstname: shipment.created_user_firstname,
          id: shipment.created_user_id,
          lastname: shipment.created_user_lastname,
          username: shipment.created_user_username,
        }
        : null,

      user_shipped_by: shipment.created_user_id
        ? {
          email: shipment.created_user_email,
          firstname: shipment.created_user_firstname,
          id: shipment.created_user_id,
          lastname: shipment.created_user_lastname,
          username: shipment.created_user_username,
        }
        : null,

      user_updated_by: shipment.updated_user_id
        ? {
          email: shipment.updated_user_email,
          firstname: shipment.updated_user_firstname,
          id: shipment.updated_user_id,
          lastname: shipment.updated_user_lastname,
          username: shipment.updated_user_username,
        }
        : shipment.created_user_id
          ? {
            email: shipment.created_user_email,
            firstname: shipment.created_user_firstname,
            id: shipment.created_user_id,
            lastname: shipment.created_user_lastname,
            username: shipment.created_user_username,
          }
          : null,

      // Enhanced disposal items and comments
      disposal_items,
      disposal_comments,
    }
  }

  async getShipmentItems(c: HonoContext, shipmentId: number) {
    const items = await c.var.trx
      .selectFrom("ws_disposal_shipment_items as wdsi")
      .innerJoin("ws_materials as material", (join) =>
        join
          .onRef("material.id", "=", "wdsi.material_id")
          .on("material.deleted_at", "is", null)
      )
      .leftJoin("ws_users as created_user", (join) =>
        join
          .onRef("created_user.id", "=", "wdsi.created_by")
          .on("created_user.deleted_by", "is", null)
      )
      .select([
        "wdsi.id",
        "wdsi.disposal_shipment_id",
        "wdsi.material_id",
        "wdsi.qty",
        "wdsi.confirmed_qty",
        "wdsi.notes",
        "wdsi.created_by",
        "wdsi.created_at",
        "wdsi.updated_at",
        "material.id as master_material_id",
        "material.name as master_material_name",
        "material.unit_of_distribution",
        "material.code as master_material_code",
        "material.description as master_material_description",
        "material.consumption_unit_per_distribution_unit as pieces_per_unit",
        "material.unit_of_consumption as unit",
        "material.is_managed_in_batch as managed_in_batch",
        "material.is_addremove",
        "material.is_open_vial",
        "material.is_stock_opname_mandatory",
        "material.material_type_id",
        "material.material_type",
        "material.hierarchy_code",
        "material.parent_id",
        "material.status as material_status",
        "material.max_temperature",
        "material.min_temperature",
        "material.is_temperature_sensitive",
        "created_user.id as created_user_id",
        "created_user.username as created_user_username",
        "created_user.email as created_user_email",
        "created_user.firstname as created_user_firstname",
        "created_user.lastname as created_user_lastname",
      ])
      .where("wdsi.disposal_shipment_id", "=", shipmentId)
      .execute()

    // Get stocks for each item and enhance the structure
    const enhancedItems: any[] = []
    for (const item of items) {
      const stocks = await this.getShipmentItemStocks(c, item.id)

      const enhancedItem = {
        id: item.id,
        confirmed_qty: item.confirmed_qty,
        created_at: item.created_at,
        disposal_shipment_id: item.disposal_shipment_id,
        master_material_id: item.master_material_id,
        material_id: item.material_id,
        other_reason: null,
        qty: item.qty,
        reason_id: null,
        shipped_qty: item.qty,

        // Enhanced master_material object matching documentation
        master_material: {
          code: item.master_material_code,
          description: item.master_material_description,
          id: item.master_material_id,
          is_addremove: item.is_addremove || 0,
          is_openvial: item.is_open_vial || 0,
          is_stockcount: item.is_stock_opname_mandatory || 0,
          is_vaccine: item.material_type === "VACCINE" ? 1 : 0,
          kfa_code: item.hierarchy_code,
          kfa_level_id: item.material_type_id,
          managed_in_batch: item.managed_in_batch,
          name: item.master_material_name,
          need_sequence: 0,
          parent_id: item.parent_id,
          pieces_per_unit: item.pieces_per_unit,
          status: item.material_status || 1,
          temperature_max: item.max_temperature || 0,
          temperature_min: item.min_temperature || 0,
          temperature_sensitive: item.is_temperature_sensitive || 0,
          unit: item.unit,
          unit_of_distribution: item.unit_of_distribution,
          updated_at: item.updated_at,
        },

        // User objects
        user_created_by: item.created_user_id
          ? {
            email: item.created_user_email,
            firstname: item.created_user_firstname,
            id: item.created_user_id,
            lastname: item.created_user_lastname,
            username: item.created_user_username,
          }
          : null,

        user_updated_by: item.created_user_id
          ? {
            email: item.created_user_email,
            firstname: item.created_user_firstname,
            id: item.created_user_id,
            lastname: item.created_user_lastname,
            username: item.created_user_username,
          }
          : null,

        // Enhanced disposal_shipment_stocks
        disposal_shipment_stocks: stocks,
      }

      enhancedItems.push(enhancedItem)
    }

    return enhancedItems
  }

  async getShipmentItemStocks(c: HonoContext, itemId: number) {
    return await c.var.trx
      .selectFrom("ws_disposal_shipment_stocks as wdss")
      .leftJoin("ws_stocks as stock", (join) =>
        join
          .onRef("stock.id", "=", "wdss.stock_id")
          .on("stock.deleted_at", "is", null)
      )
      .leftJoin("ws_batches as batch", (join) =>
        join
          .onRef("batch.id", "=", "wdss.batch_id")
          .on("batch.deleted_at", "is", null)
      )
      .leftJoin("ws_activities as activity", (join) =>
        join
          .onRef("activity.id", "=", "wdss.activity_id")
          .on("activity.deleted_at", "is", null)
      )
      .leftJoin("ws_manufactures as manufacture", (join) =>
        join
          .onRef("manufacture.id", "=", "batch.manufacture_id")
          .on("manufacture.deleted_at", "is", null)
      )
      .leftJoin(
        "ws_transaction_reasons as wtr",
        "wdss.transaction_reason_id",
        "wtr.id"
      )
      .select([
        "wdss.id",
        "wdss.disposal_shipment_item_id as disposal_item_id",
        "wdss.stock_id",
        "wdss.batch_id",
        "wdss.activity_id",
        "wdss.stock_qty",
        "wdss.received_qty as disposal_received_qty",
        "wdss.discard_qty as disposal_discard_qty",
        "wdss.transaction_reason_id",
        "wtr.title as transaction_reason",
        "wdss.created_by",
        "wdss.created_at",
        "wdss.updated_at",
        "stock.qty as available",
        "stock.allocated_qty as allocated",
        "stock.created_by as stock_created_by",
        "stock.updated_by as stock_updated_by",
        "stock.created_at as stock_created_at",
        "stock.updated_at as stock_updated_at",
        "stock.id as stock_id",
        "batch.id as batch_id",
        "batch.code as batch_code",
        "batch.expired_date",
        "batch.production_date",
        "batch.manufacture_id",
        "batch.status as batch_status",
        "manufacture.name as manufacture_name",
        "activity.id as activity_id",
        "activity.name as activity_name",
      ])
      .where("wdss.disposal_shipment_item_id", "=", itemId)
      .execute()
      .then((stocks) =>
        stocks.map((stock) => ({
          disposal_discard_qty: stock.disposal_discard_qty,
          disposal_item_id: stock.disposal_item_id,
          disposal_received_qty: stock.disposal_received_qty,
          id: stock.id,
          stock_id: stock.stock_id,
          transaction_reasons: stock.transaction_reason_id
            ? {
              id: stock.transaction_reason_id,
              title: c.var.t(
                `transaction.reason.${stock.transaction_reason}`
              ),
            }
            : null,
          stock: {
            activity: {
              id: stock.activity_id,
              is_ordered_purchase: 1,
              is_ordered_sales: 1,
              is_patient_id: 0,
              name: stock.activity_name,
            },
            activity_id: stock.activity_id,
            allocated: stock.allocated || 0,
            available: stock.available || 0,
            batch: stock.batch_id
              ? {
                code: stock.batch_code,
                expired_date: stock.expired_date,
                id: stock.batch_id,
                manufacture: {
                  name: stock.manufacture_name,
                },
                manufacture_id: stock.manufacture_id,
                manufacture_name: stock.manufacture_name,
                production_date: stock.production_date,
                status: stock.batch_status || 1,
              }
              : null,
            batch_id: stock.batch_id,
            budget_source: null,
            created_by: stock.stock_created_by,
            createdAt: stock.stock_created_at,
            id: stock.stock_id,
            material_entity_id: null,
            open_vial: 0,
            qty: stock.available || 0,
            status: null,
            stock_id: stock.stock_id,
            updated_by: stock.stock_updated_by,
            updatedAt: stock.stock_updated_at,
            year: null,
          },
        }))
      )
  }

  async getShipmentComments(c: HonoContext, shipmentId: number) {
    return await c.var.trx
      .selectFrom("ws_disposal_shipment_comments as wdsc")
      .leftJoin("ws_users as user", (join) =>
        join
          .onRef("user.id", "=", "wdsc.user_id")
          .on("user.deleted_by", "is", null)
      )
      .select([
        "wdsc.id",
        "wdsc.comment",
        "wdsc.created_at",
        "wdsc.status as disposal_shipment_status",
        "user.id as user_id",
        "user.username",
        "user.email",
        "user.firstname",
        "user.lastname",
      ])
      .where("wdsc.disposal_shipment_id", "=", shipmentId)
      .orderBy("wdsc.created_at", "desc")
      .execute()
      .then((comments) =>
        comments.map((comment) => ({
          ...comment,
          user: {
            id: comment.user_id,
            username: comment.username,
            email: comment.email,
            firstname: comment.firstname,
            lastname: comment.lastname,
          },
        }))
      )
  }

  async createShipment(c: HonoContext, data: CreateShipmentRequest) {
    // Get entity IDs from codes
    const customer = await c.var.trx
      .selectFrom("ws_entities")
      .select("id")
      .where("id", "=", data.customer_id)
      .where("deleted_at", "is", null)
      .executeTakeFirst()

    const vendor = await c.var.trx
      .selectFrom("ws_entities")
      .select("id")
      .where("id", "=", data.vendor_id)
      .where("deleted_at", "is", null)
      .executeTakeFirst()

    if (!customer || !vendor) {
      throw new ValidationError(c.var.t('disposal_shipment.error.customer_or_vendor_not_found'))
    }
    const deviceType = c.var.deviceType || 1
    const userId = c.var.userId || 1
    // Create main shipment record
    const shipmentResult = await c.var.trx
      .insertInto("ws_disposal_shipments")
      .values({
        activity_id: data.activity_id,
        customer_id: customer.id,
        vendor_id: vendor.id,
        status: DISPOSAL_SHIPMENT_STATUS.SHIPPED,
        type: data.type,
        no_document: data.no_document || null,
        comments: data.disposal_comments || null,
        shipped_at: new Date(),
        created_by: userId,
        updated_by: userId,
        created_at: new Date(),
        updated_at: new Date(),
        device_type: deviceType,
      })
      .execute()

    const insertId = Array.isArray(shipmentResult)
      ? shipmentResult[0]?.insertId
      : (shipmentResult as any)?.insertId

    if (!insertId) {
      throw new ValidationError(c.var.t('disposal_shipment.error.failed_to_create_shipment'))
    }

    const shipmentId = Number(insertId)

    // Create shipment items and stocks
    for (const item of data.disposal_items) {
      const itemResult = await c.var.trx
        .insertInto("ws_disposal_shipment_items")
        .values({
          disposal_shipment_id: shipmentId,
          material_id: item.material_id,
          qty: item.shipment_qty,
          created_by: userId,
          created_at: new Date(),
          updated_at: new Date(),
        })
        .execute()

      const itemInsertId = Array.isArray(itemResult)
        ? itemResult[0]?.insertId
        : (itemResult as any)?.insertId

      if (!itemInsertId) {
        throw new ValidationError(c.var.t('disposal_shipment.error.failed_to_create_shipment_item'))
      }

      const itemId = Number(itemInsertId)

      for (const stock of item.stocks) {
        for (const disposalStock of stock.disposal_stocks) {
          // Create stocks for this item
          await c.var.trx
            .insertInto("ws_disposal_shipment_stocks")
            .values({
              disposal_shipment_item_id: itemId,
              stock_id: stock.stock_id,
              batch_id: stock.batch?.id || null,
              activity_id: stock.activity_id,
              stock_qty: stock.stock_qty,
              received_qty: disposalStock.received_qty || null,
              discard_qty: disposalStock.discard_qty || null,
              transaction_reason_id:
                disposalStock.transaction_reasons?.id || null,
              created_by: userId,
              created_at: new Date(),
              updated_at: new Date(),
            })
            .execute()

          // Update ws_disposal_stock table for shipped quantities
          const discard = disposalStock.discard_qty || 0
          const received = disposalStock.received_qty || 0
          await c.var.trx
            .updateTable("ws_disposal_stocks")
            .set({
              disposal_discard_qty: sql`disposal_discard_qty - ${discard}`,
              disposal_received_qty: sql`disposal_received_qty - ${received}`,
              disposal_shipped_qty: sql`disposal_shipped_qty + ${discard + received}`,
              updated_by: userId,
              updated_at: new Date(),
            })
            .where("id", "=", disposalStock.disposal_stock_id)
            .execute()
        }
      }
    }

    // Create initial comment
    await c.var.trx
      .insertInto("ws_disposal_shipment_comments")
      .values({
        disposal_shipment_id: shipmentId,
        comment: data.disposal_comments || null,
        status: DISPOSAL_SHIPMENT_STATUS.SHIPPED,
        user_id: userId,
        created_at: new Date(),
      })
      .execute()

    return { id: shipmentId }
  }

  async acceptShipment(
    c: HonoContext,
    id: number,
    data: AcceptShipmentRequest,
    userId: number
  ) {
    return await db.transaction().execute(async (trx) => {
      const detail = await this.getShipmentDetail(c, id)
      const isNonAdmin = this.isNonAdmin(c)

      if (!detail) {
        throw new ValidationError(c.var.t("disposal_shipment.error.not_found"))
      }

      if (
        (isNonAdmin && detail.customer_id != c.var.entityId) ||
        detail.status !== DISPOSAL_SHIPMENT_STATUS.SHIPPED
      ) {
        throw new ValidationError(
          c.var.t("disposal_shipment.error.not_eligible_for_action", {
            action: c.var.t("disposal_shipment.action.accept"),
          })
        )
      }

      for (const item of detail.disposal_items) {
        await trx
          .updateTable("ws_disposal_shipment_items")
          .set({
            confirmed_qty: item.qty,
            updated_at: new Date(),
          })
          .where("id", "=", item.id)
          .execute()

        const emmaPayload = {
          tax: null,
          retailer_price: null,
          consumption_rate: null,
          max: null,
          min: null,
          activity_id: detail.activity_id,
          master_material_id: item.master_material.parent_id,
          entity_id: detail.customer.id,
          id: detail.customer.id,
        }

        this.#createEmma(
          c,
          detail.customer_id,
          item.master_material.parent_id,
          emmaPayload
        )

        for (const dsStocks of item.disposal_shipment_stocks) {
          //cari stock id
          const stockSender = await trx
            .selectFrom("ws_stocks as stocks")
            .leftJoin("ws_batches as batch", (join) =>
              join
                .onRef("batch.id", "=", "stocks.batch_id")
                .on("batch.deleted_at", "is", null)
            )
            .select([
              "stocks.material_id",
              "stocks.activity_id",
              "stocks.batch_id",
              "stocks.id as stocks_id",
              "stocks.budget_source_id",
              "stocks.stock_quality_id",
              "stocks.year",
              "stocks.price",
              "stocks.total_price",
              "stocks.created_by",
              "stocks.updated_by",
              "stocks.activity_id",
              "stocks.parent_material_id",

              "batch.manufacture_id",
              "batch.code",
              "batch.production_date",
              "batch.expired_date",
              "batch.status",
              "batch.material_id as batch_material_id",
            ])
            .where("stocks.id", "=", dsStocks.stock_id)
            .where("stocks.deleted_at", "is", null)
            .executeTakeFirst()

          if (!stockSender) {
            throw new ValidationError(
              c.var.t("disposal_shipment.error.stock_sender_not_found")
            )
          }

          const stockReceiver = await trx
            .selectFrom("ws_stocks as stocks")
            .leftJoin("ws_batches as batch", (join) =>
              join
                .onRef("batch.id", "=", "stocks.batch_id")
                .on("batch.deleted_at", "is", null)
            )
            .select(["stocks.id"])
            .where("stocks.material_id", "=", stockSender.material_id)
            .where("stocks.activity_id", "=", stockSender.activity_id)
            .where("stocks.entity_id", "=", detail.customer_id)
            .where((eb) =>
              stockSender.batch_id == null
                ? eb("batch_id", "is", null)
                : eb("batch.code", "=", stockSender.code)
            )
            .where("stocks.deleted_at", "is", null)
            .executeTakeFirst()

          let stockReceiverId = stockReceiver?.id

          if (!stockReceiver) {
            let newBatchId: number | null = null

            if (stockSender.batch_id != null) {
              const batchNew = await trx
                .insertInto("ws_batches")
                .values({
                  manufacture_id: stockSender.manufacture_id,
                  code: stockSender.code,
                  production_date: stockSender.production_date,
                  expired_date: stockSender.expired_date,
                  status: stockSender.status,
                  material_id: stockSender.batch_material_id,
                })
                .executeTakeFirst()

              newBatchId = Number(batchNew?.insertId)
            }

            const stockReceiverNew = await trx
              .insertInto("ws_stocks")
              .values({
                batch_id: newBatchId,
                budget_source_id: stockSender.budget_source_id,
                qty: 0,
                allocated_qty: 0,
                in_transit_qty: 0,
                stock_quality_id: stockSender.stock_quality_id,
                year: stockSender.year,
                price: stockSender.price,
                total_price: stockSender.total_price,
                created_by: userId,
                updated_by: stockSender.updated_by,
                entity_id: detail.customer_id,
                material_id: stockSender.material_id,
                activity_id: stockSender.activity_id,
                open_vial_qty: 0,
                exterminated_qty: 0,
                parent_material_id: stockSender.parent_material_id,
                unreceived_qty: 0,
              })
              .executeTakeFirst()
            stockReceiverId = Number(stockReceiverNew?.insertId)
          }

          if (!stockReceiverId) {
            throw new ValidationError(
              c.var.t("disposal_shipment.error.stock_receiver_id_not_found")
            )
          }

          const disposalReceiverStocks = await trx
            .selectFrom("ws_disposal_stocks")
            .select(["id"])
            .where(
              "transaction_reason_id",
              "=",
              dsStocks.transaction_reasons.id
            )
            .where("stock_id", "=", stockReceiverId)
            .executeTakeFirst()
          // disposalReceiverStocks
          if (!disposalReceiverStocks) {
            await trx
              .insertInto("ws_disposal_stocks")
              .values({
                stock_id: stockReceiverId,
                disposal_received_qty:
                  dsStocks.disposal_discard_qty +
                  dsStocks.disposal_received_qty,
                created_by: userId,
                transaction_reason_id: dsStocks.transaction_reasons.id,
              })
              .executeTakeFirst()
          } else {
            await trx
              .updateTable("ws_disposal_stocks")
              .set({
                disposal_received_qty: sql`disposal_received_qty + ${dsStocks.disposal_discard_qty + dsStocks.disposal_received_qty}`,
                updated_by: userId,
                updated_at: new Date(),
              })
              .where("id", "=", disposalReceiverStocks.id)
              .execute()
          }
        }
      }

      // Update shipment status
      await trx
        .updateTable("ws_disposal_shipments")
        .set({
          status: DISPOSAL_SHIPMENT_STATUS.FULFILLED,
          fulfilled_at: new Date(),
          updated_by: userId,
          updated_at: new Date(),
        })
        .where("id", "=", id)
        .execute()

      if (data.comment) {
        await trx
          .insertInto("ws_disposal_shipment_comments")
          .values({
            disposal_shipment_id: id,
            comment: data.comment,
            status: DISPOSAL_SHIPMENT_STATUS.FULFILLED,
            user_id: userId,
            created_at: new Date(),
          })
          .execute()
      }
      return { id, status: "fulfilled" }
    })
  }

  async commentShipment(
    c: HonoContext,
    id: number,
    data: CancelShipmentRequest,
    userId: number,
    current_status: number
  ) {
    // Add comment
    const action = await c.var.trx
      .insertInto("ws_disposal_shipment_comments")
      .values({
        disposal_shipment_id: id,
        comment: data.comment,
        status: current_status,
        user_id: userId,
        created_at: new Date(),
      })
      .executeTakeFirst()

    return { id: Number(action?.insertId) }
  }

  async cancelShipment(
    c: HonoContext,
    id: number,
    data: CancelShipmentRequest,
    userId: number
  ) {
    return await db.transaction().execute(async (trx) => {
      // Update shipment status
      const isNonAdmin = this.isNonAdmin(c)

      const result = await trx
        .updateTable("ws_disposal_shipments")
        .set({
          status: DISPOSAL_SHIPMENT_STATUS.CANCELLED,
          cancelled_at: new Date(),
          updated_by: userId,
          updated_at: new Date(),
        })
        .$if(isNonAdmin, (qb) =>
          qb.where("vendor_id", "=", c.var.entityId ?? 0),
        )
        .where("id", "=", id)
        .where("status", "=", DISPOSAL_SHIPMENT_STATUS.SHIPPED)
        .execute()

      const affectedRows = result[0]?.numUpdatedRows ?? 0;
      if (affectedRows <= 0) {
        throw new ValidationError(c.var.t("disposal_shipment.error.not_eligible_for_action", { action: c.var.t("disposal_shipment.action.cancel") }))
      }

      const disposalItems = await this.getShipmentItems(c, id)
      for (const item of disposalItems) {
        for (const dsStocks of item.disposal_shipment_stocks) {
          const discard = dsStocks.disposal_discard_qty || 0
          const received = dsStocks.disposal_received_qty || 0
          // Update ws_disposal_stock table for cancel quantities
          await c.var.trx
            .updateTable("ws_disposal_stocks")
            .set({
              disposal_discard_qty: sql`disposal_discard_qty + ${discard}`,
              disposal_received_qty: sql`disposal_received_qty + ${received}`,
              disposal_shipped_qty: sql`disposal_shipped_qty - ${discard + received}`,
              updated_by: userId,
              updated_at: new Date(),
            })
            .where("stock_id", "=", dsStocks.stock_id)
            .where(
              "transaction_reason_id",
              "=",
              dsStocks.transaction_reasons.id
            )
            .execute()
        }
      }
      if (data.comment) {
        // Add comment
        await (trx as any)
          .insertInto("ws_disposal_shipment_comments")
          .values({
            disposal_shipment_id: id,
            comment: data.comment,
            status: DISPOSAL_SHIPMENT_STATUS.CANCELLED,
            user_id: userId,
            created_at: new Date(),
          })
          .execute()
      }
      return { id, status: "cancelled" }
    })
  }

  public getStatusLabel(status: number): string {
    switch (status) {
      case DISPOSAL_SHIPMENT_STATUS.PENDING:
        return "PENDING"
      case DISPOSAL_SHIPMENT_STATUS.CONFIRMED:
        return "CONFIRMED"
      case DISPOSAL_SHIPMENT_STATUS.ALLOCATED:
        return "ALLOCATED"
      case DISPOSAL_SHIPMENT_STATUS.SHIPPED:
        return "SHIPPED"
      case DISPOSAL_SHIPMENT_STATUS.FULFILLED:
        return "FULFILLED"
      case DISPOSAL_SHIPMENT_STATUS.CANCELLED:
        return "CANCELLED"
      default:
        return "UNKNOWN"
    }
  }

  private isNonAdmin(c: HonoContext): boolean {
    return c.var.deviceType === DEVICE_TYPE.mobile && (c.var.roleId === USER_ROLE.MANAGER || c.var.roleId === USER_ROLE.OPERATOR)
  }

  private getEntityTypeLabel(type: number): string {
    switch (type) {
      case 1:
        return "PROVINSI"
      case 2:
        return "KOTA"
      case 3:
        return "FASKES"
      default:
        return "UNKNOWN"
    }
  }

  // todo

  readonly #createEmma = async (
    c: HonoContext,
    customerId: number,
    materialMasterParentId: number,
    data: any
  ) => {
    const isKFAEnabled = c.var.config?.material.is_hierarchy_enabled || false
    const dataEntityMaterial =
      await this.entityMaterialRepo.getEntityMaterialsByEntityIDandMaterialID(
        c,
        c.var.programId,
        customerId,
        materialMasterParentId
      )
    if (!isKFAEnabled) {
      await this.#createWithoutKFA(c, dataEntityMaterial, data)
    } else {
      await this.#createWithoutKFA(c, dataEntityMaterial, data)
      await this.#createWithKFA(c, data)
    }
  }

  readonly #createWithKFA = async (
    c: HonoContext,
    body: any
  ) => {
    const userID = c.var.userId
    const cudDefault = {
      created_by: userID ?? 0,
      created_at: new Date(),
      updated_by: userID ?? 0,
      updated_at: new Date(),
      deleted_at: null,
    }
    const deletedNull = {
      // created_by: userID ?? 0,
      // created_at: new Date(),
      // updated_by: userID ?? 0,
      updated_at: new Date(),
      deleted_by: null,
      deleted_at: null,
    }

    // Need: fix this for hierarchy material which has children
    const materialChilds = await this.entityMaterialRepo.getMaterialChild(
      c,
      [body.master_material_id],
      body.activity_id,
      c.var.programId
    )
    const entityMaterialChilds = await Promise.all(
      materialChilds.map(async (materialChild) => {
        return this.entityMaterialRepo.getEntityMaterialsByEntityIDandMaterialID(
          c,
          c.var.programId,
          body.entity_id,
          materialChild.id,
          body.activity_id
        )
      })
    )
    const entityMaterialChildsFiltered = entityMaterialChilds.filter(
      (child) => child !== undefined
    )
    const materialChildIDs = collect(materialChilds, "id")
    const materialChildExistIDs = collect(
      entityMaterialChildsFiltered,
      "material_id"
    )
    const materialChildDifferences = differ(
      materialChildIDs,
      materialChildExistIDs
    )
    const entityMaterialChildsIDs = collect(entityMaterialChildsFiltered, "id")
    let entityMaterialActivity: any[] = []
    if (entityMaterialChildsIDs.length !== 0) {
      entityMaterialActivity =
        await this.entityMaterialRepo.findDynamicEntityMaterialActivity(
          c,
          "id",
          "in",
          entityMaterialChildsIDs,
          c.var.programId,
          true
        )
    }
    await Promise.all([
      ...entityMaterialActivity.map(async (emma) => {
        return emma.deleted_at
          ? this.entityMaterialRepo.updateEntityMaterialActivity(c, emma.id, {
            ...deletedNull,
          })
          : null
      }),
    ])

    const dataEntityMaterialCreate: EntityMaterialDTO[] = []
    for (const materialChild of materialChildDifferences) {
      dataEntityMaterialCreate.push({
        entity_id: Number(body.entity_id),
        material_id: materialChild,
        activity_id: Number(body.activity_id),
        consumption_rate: body.consumption_rate,
        retailer_price: body.retailer_price,
        tax: body.tax,
        min: body.min,
        max: body.max,
        ...cudDefault,
      })
    }

    const resEntityMaterial = await Promise.all(
      dataEntityMaterialCreate.map(async (emma) => {
        return this.entityMaterialRepo.createEntityMaterial(c, emma)
      })
    )

    await Promise.all(
      dataEntityMaterialCreate.map(async (emma) => {
        return this.stockRepo.createDummyStock(
          c,
          emma.entity_id ?? 0,
          emma.material_id ?? 0,
          emma.activity_id ?? 0,
          body.master_material_id
        )
      })
    )

    await this.entityMaterialRepo.updateUserAndDateEntity(
      c,
      Number(body.entity_id),
      { updated_at: new Date(), updated_by: userID }
    )
  }

  readonly #createWithoutKFA = async (
    c: HonoContext,
    dataEntityMaterial: any,
    body: any
  ) => {
    const userID = c.var.userId ?? 0
    const cudDefault = {
      created_by: userID,
      created_at: new Date(),
      updated_by: userID,
      updated_at: new Date(),
      deleted_at: null,
    }
    const entityMaterialActivity =
      await this.entityMaterialRepo.getEntityMaterialActivity(
        c,
        [],
        [body.activity_id],
        [dataEntityMaterial?.id ?? 0],
        c.var.programId,
        true
      )

    if (entityMaterialActivity.length === 0) {
      const emma = {
        entity_id: Number(body.entity_id),
        material_id: Number(body.master_material_id),
        activity_id: Number(body.activity_id),
        consumption_rate: body.consumption_rate,
        retailer_price: body.retailer_price,
        tax: body.tax,
        min: body.min,
        max: body.max,
        ...cudDefault,
      }

      await Promise.all([
        this.entityMaterialRepo.createEntityMaterial(c, emma).then((res) => {

        }),
        this.stockRepo.createDummyStock(
          c,
          emma.entity_id,
          emma.material_id,
          emma.activity_id
        ),
        this.entityMaterialRepo.updateUserAndDateEntity(
          c,
          Number(body.entity_id),
          {
            updated_at: new Date(),
            updated_by: userID,
          }
        ),
      ])
    } else if (
      entityMaterialActivity.length > 0 &&
      entityMaterialActivity[0]?.deleted_at
    ) {
      await Promise.all([
        this.entityMaterialRepo.updateEntityMaterialActivity(
          c,
          entityMaterialActivity[0].id,
          {
            min: body.min,
            max: body.max,
            consumption_rate: body.consumption_rate,
            retailer_price: body.retailer_price,
            tax: body.tax,
            updated_at: new Date(),
            updated_by: userID,
            deleted_at: null,
            deleted_by: null,
          }
        ),
        this.entityMaterialRepo.updateUserAndDateEntity(
          c,
          Number(body.entity_id),
          {
            updated_at: new Date(),
            updated_by: userID,
          }
        ),
      ])
    }
  }
}
