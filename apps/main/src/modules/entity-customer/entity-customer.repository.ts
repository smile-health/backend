import { db } from "@/common/infrastructure/database/index.js"
import { DB } from "@/common/infrastructure/database/types/db.js"
import { Context } from "@smile/lib/types/context.js"
import { Context as CtxHono } from "Hono"
import { CompiledQuery, sql } from "kysely"
import moment from "moment"
import { ListCustomerVendorActivityDTO } from "../app-mobile-data/app-mobile-data.schema.js"
import { BaseRepository } from "../base.repository.js"
import {
  CustomerHasActivitiesDTO,
  CustomerVendorsDTO,
  EntityDetailRelationCustomerDTO,
  GetEntitiesCustomersQueries,
  GetEntitiesCustomersRelationQueries,
} from "./entity-customer.schema.js"

export class EntityCustomerRepository extends BaseRepository<"ws_customer_vendors"> {
  constructor() {
    super("ws_customer_vendors")
  }

  #generateQueryWhereClause(
    query,
    entityDetail: EntityDetailRelationCustomerDTO
  ) {
    const { province_id, regency_id, sub_district_id, village_id } =
      entityDetail

    if (village_id) {
      query = query.where("village_id", "=", village_id)
    } else if (sub_district_id) {
      query = query
        .where("sub_district_id", "=", sub_district_id)
        .where("village_id", "is not", null)
    } else if (regency_id) {
      query = query
        .where("regency_id", "=", regency_id)
        .where("sub_district_id", "is not", null)
    } else if (province_id) {
      query = query
        .where("province_id", "=", province_id)
        .where("regency_id", "is not", null)
    }

    return query
  }

  async getListEntityCustomer(
    c: Context<DB>,
    id: number,
    params: GetEntitiesCustomersQueries,
    programId: number
  ) {
    const { page, paginate, keyword, is_consumption, is_vendor, activity_id } =
      params
    const offset = (page - 1) * paginate
    let query = c.var.trx
      .with("customers", (db) =>
        db
          .selectFrom("ws_entities as e")
          .leftJoin("ws_customer_vendors as cv", (join) =>
            join
              .onRef("cv.vendor_id", "=", "e.id")
              .on("cv.deleted_at", "is", null)
              .on("cv.program_id", "=", programId)
          )
          .where("e.id", "=", id)
          .where("e.status", "=", 1)
          .where("e.deleted_at", "is", null)
          .where("e.program_id", "=", programId)
          .where("cv.is_consumption", "=", is_consumption)
          .select(["cv.id", "cv.customer_id", "cv.vendor_id"])
      )
      .selectFrom("customers as c")
      .leftJoin("ws_entities as e", (join) =>
        join.onRef("e.id", "=", "c.customer_id").on("e.deleted_at", "is", null)
      )
      .leftJoin("entity_tags as et", "et.id", "e.entity_tag_id")
      .leftJoin("locations as p", (join) =>
        join.onRef("p.id", "=", "e.province_id").on("p.level", "=", 0)
      )
      .leftJoin("locations as r", (join) =>
        join
          .onRef("r.id", "=", "e.regency_id")
          .onRef("r.parent_id", "=", "p.id")
          .on("r.level", "=", 1)
      )
      .leftJoin("locations as sd", (join) =>
        join
          .onRef("sd.id", "=", "e.sub_district_id")
          .onRef("sd.parent_id", "=", "r.id")
          .on("sd.level", "=", 2)
      )
      .leftJoin("locations as v", (join) =>
        join
          .onRef("v.id", "=", "e.village_id")
          .onRef("v.parent_id", "=", "sd.id")
          .on("v.level", "=", 3)
      )
      .leftJoin("ws_customer_vendor_activities as cha", (join) =>
        join
          .onRef("cha.customer_vendor_id", "=", "c.id")
          .on("c.vendor_id", "=", id)
          .on("cha.deleted_at", "is", null)
      )
      .leftJoin("ws_activities as ma", (join) =>
        join
          .onRef("ma.id", "=", "cha.activity_id")
          .on("ma.deleted_at", "is", null)
          .on("ma.program_id", "=", programId)
      )
      .where("e.deleted_at", "is", null)
      .where("e.status", "=", 1)

    if (keyword) {
      query = query.where("e.name", "like", `%${keyword}%`)
    }

    if (is_vendor) {
      query = query.where("e.is_vendor", "=", is_vendor)
    }

    if (activity_id) {
      query = query.where("ma.id", "=", activity_id)
    }

    const [list, totalList] = await Promise.all([
      query
        .select([
          "c.customer_id",
          "e.name",
          "e.address",
          "et.is_open_vial",
          sql<string>`CONCAT_WS(', ', v.name, sd.name, r.name, p.name)`.as(
            "location"
          ),
          sql<[]>`JSON_ARRAYAGG(JSON_OBJECT('id', ma.id, 'name', ma.name))`.as(
            "activity"
          ),
        ])
        .groupBy("c.customer_id")
        .limit(paginate)
        .offset(offset)
        .execute(),
      query
        .select([sql<number>`COUNT(DISTINCT c.customer_id)`.as("total")])
        .executeTakeFirst(),
    ])

    return {
      list,
      total: Number(totalList?.total) || 0,
    }
  }

  async getEntityDetail(c: Context<DB>, id: number, programId: number) {
    return c.var.trx
      .selectFrom("ws_entities as e")
      .leftJoin("locations as p", (join) =>
        join.onRef("p.id", "=", "e.province_id").on("p.level", "=", 0)
      )
      .leftJoin("locations as r", (join) =>
        join
          .onRef("r.id", "=", "e.regency_id")
          .onRef("r.parent_id", "=", "p.id")
          .on("p.level", "=", 1)
      )
      .leftJoin("locations as sd", (join) =>
        join
          .onRef("sd.id", "=", "e.sub_district_id")
          .onRef("sd.parent_id", "=", "r.id")
          .on("p.level", "=", 2)
      )
      .leftJoin("locations as v", (join) =>
        join
          .onRef("v.id", "=", "e.village_id")
          .onRef("v.parent_id", "=", "sd.id")
          .on("p.level", "=", 3)
      )
      .where("e.deleted_at", "is", null)
      .where("e.program_id", "=", programId)
      .select([
        "e.id",
        "e.name",
        "e.is_vendor",
        "e.type",
        "e.village_id as village_id",
        "e.sub_district_id as sub_district_id",
        "e.regency_id as regency_id",
        "e.province_id as province_id",
        sql<string>`CONCAT_WS(', ', v.name, sd.name, r.name, p.name)`.as(
          "location"
        ),
      ])
      .where("e.id", "=", id)
      .where("e.status", "=", 1)
      .executeTakeFirst()
  }

  async getEntitiesCustomerStreamData(
    c: Context<DB>,
    id: number,
    params: GetEntitiesCustomersQueries,
    programId: number
  ) {
    const { keyword, is_consumption, is_vendor, activity_id } = params
    let query = c.var.trx
      .with("customers", (db) =>
        db
          .selectFrom("ws_entities as e")
          .leftJoin("ws_customer_vendors as cv", (join) =>
            join
              .onRef("cv.vendor_id", "=", "e.id")
              .on("cv.deleted_at", "is", null)
              .on("cv.program_id", "=", programId)
              .on("cv.vendor_id", "=", id)
          )
          .where("e.id", "=", id)
          .where("e.status", "=", 1)
          .where("e.deleted_at", "is", null)
          .where("e.program_id", "=", programId)
          .where("cv.is_consumption", "=", is_consumption)
          .select(["cv.customer_id", "cv.id"])
      )
      .selectFrom("customers as c")
      .leftJoin("ws_entities as e", (join) =>
        join.onRef("e.id", "=", "c.customer_id").on("e.deleted_at", "is", null)
      )
      .leftJoin("users as u", (join) => join.onRef("u.id", "=", "e.created_by"))
      .leftJoin("ws_customer_vendor_activities as cha", (join) =>
        join
          .onRef("cha.customer_vendor_id", "=", "c.id")
          .on("cha.deleted_at", "is", null)
      )
      .leftJoin("ws_activities as ma", (join) =>
        join
          .onRef("ma.id", "=", "cha.activity_id")
          .on("ma.deleted_at", "is", null)
          .on("ma.program_id", "=", programId)
      )
      .where("e.deleted_at", "is", null)
      .where("e.status", "=", 1)
      .select([
        "e.name",
        sql<string>`GROUP_CONCAT(ma.name SEPARATOR ', ')`.as("activity"),
        sql<string>`CONCAT_WS(' ',u.firstname,u.lastname)`.as("full_user_name"),
        "e.created_by",
        "e.updated_at",
      ])
      .groupBy("c.customer_id")

    if (keyword) {
      query = query.where("e.name", "like", `%${keyword}%`)
    }

    if (is_vendor) {
      query = query.where("e.is_vendor", "=", is_vendor)
    }

    if (activity_id) {
      query = query.where("ma.id", "=", activity_id)
    }

    return query.stream()
  }

  async getListEntityCustomerBaseOnLocation(
    c: Context<DB>,
    params: GetEntitiesCustomersRelationQueries,
    entityDetail: EntityDetailRelationCustomerDTO,
    mapIDListCustomer: number[],
    programId: number
  ) {
    const { page, paginate, keyword, is_consumption } = params
    const offset = (page - 1) * paginate

    let query = c.var.trx
      .selectFrom("ws_entities")
      .where("deleted_at", "is", null)
      .where("program_id", "=", programId)
      .where("id", "not in", mapIDListCustomer)
      .where("is_vendor", "=", is_consumption === 1 ? 0 : 1)
      .where("status", "=", 1)

    if (keyword) {
      query = query.where("name", "like", `%${keyword}%`)
    }

    query = this.#generateQueryWhereClause(query, entityDetail)

    const [list, totalCount] = await Promise.all([
      query.select(["id", "name"]).limit(paginate).offset(offset).execute(),
      query.select((eb) => eb.fn.countAll().as("total")).executeTakeFirst(),
    ])

    return { list, total: Number(totalCount?.total) || 0 }
  }

  getListEntity(c: Context<DB>, listEntity: number[]) {
    return c.var.trx
      .selectFrom("ws_entities")
      .where("deleted_at", "is", null)
      .where("status", "=", 1)
      .where("id", "in", listEntity)
      .select(["id", "is_vendor"])
      .execute()
  }

  async getListActivity(
    c: Context<DB>,
    listActivity: number[],
    programId: number
  ) {
    return c.var.trx
      .selectFrom("ws_activities")
      .where("id", "in", listActivity)
      .where("deleted_at", "is", null)
      .where("program_id", "=", programId)
      .select(["id"])
      .execute()
  }

  async getListEntityActivity(
    c: Context<DB>,
    entityID: number,
    customerID: number,
    programId: number
  ) {
    return c.var.trx
      .selectFrom("ws_customer_vendors as cv")
      .leftJoin("ws_customer_vendor_activities as cha", (join) =>
        join.onRef("cha.customer_vendor_id", "=", "cv.id")
      )
      .where("cv.vendor_id", "=", entityID)
      .where("cv.customer_id", "=", customerID)
      .where("cv.program_id", "=", programId)
      .where("cv.deleted_at", "is", null)
      .select([
        "cv.id",
        "cv.vendor_id",
        "cv.customer_id",
        "cv.program_id",
        "cha.activity_id",
      ])
      .execute()
  }

  async insertActivities(c: Context<DB>, data: CustomerHasActivitiesDTO[]) {
    return c.var.trx
      .insertInto("ws_customer_vendor_activities")
      .values(data)
      .execute()
  }

  async getOneCustomerVendor(
    c: Context<DB>,
    entityID: number,
    customerID: number,
    programId: number
  ) {
    return c.var.trx
      .selectFrom("ws_customer_vendors as cv")
      .select("cv.id")
      .where("cv.vendor_id", "=", entityID)
      .where("cv.customer_id", "=", customerID)
      .where("cv.program_id", "=", programId)
      .where("cv.deleted_at", "is", null)
      .executeTakeFirst()
  }

  async deleteActivities(
    c: Context<DB>,
    listCustomerVendorID: number[],
    listActivityID: number[]
  ) {
    let query = c.var.trx
      .updateTable("ws_customer_vendor_activities")
      .set({
        deleted_at: new Date(),
      })
      .where("customer_vendor_id", "in", listCustomerVendorID)
      .where("deleted_at", "is", null)

    if (listActivityID.length > 0) {
      query = query.where("activity_id", "not in", listActivityID)
    }

    return query.executeTakeFirst()
  }

  async getListEntityCustomers(c: Context<DB>, id: number, programId: number) {
    return c.var.trx
      .selectFrom("ws_customer_vendors")
      .where("vendor_id", "=", id)
      .where("deleted_at", "is", null)
      .where("program_id", "=", programId)
      .select(["customer_id"])
      .execute()
  }

  async getEntityCustomer(
    c: Context<DB>,
    vendorID: number,
    listCustomerID: number[],
    programId: number
  ) {
    return c.var.trx
      .selectFrom("ws_customer_vendors")
      .where("vendor_id", "=", vendorID)
      .where("customer_id", "in", listCustomerID)
      .where("program_id", "=", programId)
      .where("deleted_at", "is", null)
      .select(["id", "customer_id", "vendor_id"])
      .execute()
  }

  async insertCustomer(c: Context<DB>, data: CustomerVendorsDTO[]) {
    return c.var.trx.insertInto("ws_customer_vendors").values(data).execute()
  }

  async getListEntityCustomerBaseOnLocationStreamData(
    c: Context<DB>,
    entityDetail: EntityDetailRelationCustomerDTO,
    mapIDListCustomer: number[],
    programId: number
  ) {
    let query = c.var.trx
      .selectFrom("ws_entities as wse")
      .leftJoin("entity_tags as et", "et.id", "wse.entity_tag_id")
      .where("wse.deleted_at", "is", null)
      .where("wse.program_id", "=", programId)
      .where("wse.status", "=", 1)
      .where("wse.id", "not in", mapIDListCustomer)
    query = this.#generateQueryWhereClause(query, entityDetail)

    return query
      .select([
        "wse.id",
        "wse.name",
        "wse.is_vendor",
        "et.title as entity_tag_name",
      ])
      .stream()
  }

  getListActivityStreamData(c: Context<DB>, id: number, programId: number) {
    const startDate = moment().startOf("day").format("YYYY-MM-DD HH:mm:ss")
    const endDate = moment().endOf("day").format("YYYY-MM-DD HH:mm:ss")
    return c.var.trx
      .selectFrom("ws_activities as wsa")
      .innerJoin("ws_entity_activities as wsea", (join) =>
        join
          .onRef("wsea.activity_id", "=", "wsa.id")
          .on("wsea.entity_id", "=", id)
          .on("wsea.deleted_at", "is", null)
      )
      .innerJoin("ws_entities as wse", (join) =>
        join
          .onRef("wsea.entity_id", "=", "wse.id")
          .on("wse.deleted_at", "is", null)
          .on("wse.program_id", "=", programId)
      )
      .where("wsa.deleted_at", "is", null)
      .where("wsa.program_id", "=", programId)
      .where((eb) =>
        eb.or([
          eb("wsea.end_date", ">=", sql<Date>`${startDate}`),
          eb("wsea.end_date", "is", null),
        ])
      )
      .where("wsea.start_date", "<=", sql<Date>`${endDate}`)
      .select(["wsa.id", "wsa.name"])
      .stream()
  }

  async getValidateListEntityCustomerRelation(
    c: Context<DB>,
    entityDetail: EntityDetailRelationCustomerDTO,
    mapIDListCustomer: number[],
    programId: number
  ) {
    let query = c.var.trx
      .selectFrom("ws_entities")
      .where("deleted_at", "is", null)
      .where(
        "id",
        "not in",
        mapIDListCustomer.length > 0 ? mapIDListCustomer : [-1]
      )
      .where("program_id", "=", programId)
      .where("status", "=", 1)
    query = this.#generateQueryWhereClause(query, entityDetail)

    const listEntity = await query.select(["id", "name"]).execute()

    return listEntity
  }

  async getValidateListEntityActivities(
    c: Context<DB>,
    entityID: number,
    programId: number
  ) {
    return c.var.trx
      .selectFrom("ws_customer_vendors as cv")
      .leftJoin("ws_customer_vendor_activities as cha", (join) =>
        join
          .onRef("cha.customer_vendor_id", "=", "cv.id")
          .on("cha.deleted_at", "is", null)
      )
      .where("cv.vendor_id", "=", entityID)
      .where("cv.program_id", "=", programId)
      .where("cv.deleted_at", "is", null)
      .select(["cv.customer_id", "cha.activity_id"])
      .execute()
  }

  async deleteCustomerEntity(c: Context<DB>, listCustomerVendorID: number[]) {
    const query = c.var.trx
      .updateTable("ws_customer_vendors")
      .set({
        deleted_at: new Date(),
      })
      .where("id", "in", listCustomerVendorID)

    return query.executeTakeFirst()
  }

  async getCustomerDistributionConsumptionEntityTag(c: CtxHono) {
    const { rows } = await db.executeQuery(
      CompiledQuery.raw(
        "select get_customers_distribution_consumption_entityTag(?, ?) as result",
        [c.var.programId, c.var.entityId]
      )
    )

    return rows[0] as {
      result: Pick<
        ListCustomerVendorActivityDTO,
        "customers" | "customer_consumptions"
      >
    }
  }

  async checkActiveOrder(
    c: Context<DB>,
    id: number,
    entityIDRelation: number[],
    activityIds: number[]
  ) {
    const activeOrder = await c.var.trx
      .selectFrom("ws_orders")
      .select(["customer_id", "vendor_id"])
      .where("deleted_at", "is", null)
      .where("activity_id", "in", activityIds.length > 0 ? activityIds : [-1])
      .where("customer_id", "in", entityIDRelation)
      .where("vendor_id", "=", id)
      .execute()

    return activeOrder
  }

  async getVendorByCustomerId(
    c: Context<DB>,
    customerId: number,
    entityTypeId?: number,
    entityCode?: string
  ) {
    return c.var.trx
      .selectFrom("ws_customer_vendors as cv")
      .leftJoin("ws_entities as e", (join) =>
        join.onRef("e.id", "=", "cv.vendor_id").on("e.deleted_at", "is", null)
      )
      .select(["cv.id", "cv.vendor_id", "e.name as vendor_name"])
      .where("cv.customer_id", "=", customerId)
      .where("cv.deleted_at", "is", null)
      .$if(!!entityTypeId, (eb) => eb.where("e.type", "=", entityTypeId!))
      .$if(!!entityCode, (eb) => eb.where("e.code", "=", entityCode!))
      .executeTakeFirst()
  }
}
