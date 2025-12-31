import { DB } from "@/common/infrastructure/database/types/db.js"
import { Context } from "@smile/lib/types/context.js"
import {
  GetEntitiesCustomersQueries,
  GetEntitiesCustomersRelationQueries,
  GetExcelFileEntitiesCustomerQueries,
  CustomerHasActivitiesDTO,
  CustomerVendorsDTO,
  EntityDetailRelationCustomerDTO,
} from "./entity-customer.schema.js"
import { sql } from "kysely"

export class EntityCustomerRepository {
  #generateQueryWhereClause(dataObject) {
    const { keyword, province_id, regency_id, sub_district_id, village_id } =
      dataObject
    let { query } = dataObject
    if (keyword) {
      query = query.where("name", "like", `%${keyword}%`)
    }

    if (village_id) {
      query = query.where("village", "=", village_id)
    } else if (sub_district_id) {
      query = query.where("sub_district_id", "=", sub_district_id)
    } else if (regency_id) {
      query = query.where("regency_id", "=", regency_id)
    } else if (province_id) {
      query = query.where("province_id", "=", province_id)
    }

    return query
  }

  async getListEntityCustomer(
    c: Context<DB>,
    id: number,
    params: GetEntitiesCustomersQueries
  ) {
    const { page, paginate, keyword, is_consumption } = params
    const offset = (page - 1) * paginate
    let query = c.var.trx
      .with("customers", (db) =>
        db
          .selectFrom("entities as e")
          .leftJoin("customer_vendors as cv", (join) =>
            join
              .onRef("cv.vendor_id", "=", "e.id")
              .on("cv.deleted_at", "is", null)
          )
          .where("e.id", "=", id)
          .where("e.status", "=", 1)
          .where("e.deleted_at", "is", null)
          .where("cv.is_consumption", "=", is_consumption)
          .select(["cv.customer_id"])
      )
      .selectFrom("customers as c")
      .leftJoin("entities as e", (join) =>
        join.onRef("e.id", "=", "c.customer_id").on("e.deleted_at", "is", null)
      )
      .leftJoin("provinces as p", (join) =>
        join.onRef("p.id", "=", "e.province_id").on("p.deleted_at", "is", null)
      )
      .leftJoin("regencies as r", (join) =>
        join.onRef("r.id", "=", "e.regency_id").on("r.deleted_at", "is", null)
      )
      .leftJoin("sub_districts as sd", (join) =>
        join
          .onRef("sd.id", "=", "e.sub_district_id")
          .on("sd.deleted_at", "is", null)
      )
      .leftJoin("villages as v", (join) =>
        join.onRef("v.id", "=", "e.village_id").on("v.deleted_at", "is", null)
      )
      .leftJoin("customer_has_activities as cha", (join) =>
        join
          .onRef("cha.customer_id", "=", "c.customer_id")
          .on("cha.vendor_id", "=", id)
          .on("cha.deleted_at", "is", null)
      )
      .leftJoin("master_activities as ma", (join) =>
        join
          .onRef("ma.id", "=", "cha.activity_id")
          .on("ma.deleted_at", "is", null)
      )
      .where("e.deleted_at", "is", null)
      .where("e.status", "=", 1)
      .select([
        "c.customer_id",
        "e.name",
        "e.address",
        sql<string>`CONCAT_WS(', ', v.name, sd.name, r.name, p.name)`.as(
          "location"
        ),
        sql<[]>`JSON_ARRAYAGG(JSON_OBJECT('id', ma.id, 'name', ma.name))`.as(
          "activity"
        ),
      ])

    if (keyword) {
      query = query.where("e.name", "like", `%${keyword}%`)
    }

    const listEntity = await query
      .groupBy("c.customer_id")
      .limit(paginate)
      .offset(offset)
      .execute()
    return listEntity
  }

  async getTotalCountEntityCustomer(
    c: Context<DB>,
    id: number,
    params: GetEntitiesCustomersQueries
  ) {
    const { keyword, is_consumption } = params

    let query = c.var.trx
      .with("customers", (db) =>
        db
          .selectFrom("entities as e")
          .leftJoin("customer_vendors as cv", (join) =>
            join
              .onRef("cv.vendor_id", "=", "e.id")
              .on("cv.deleted_at", "is", null)
          )
          .where("e.id", "=", id)
          .where("e.status", "=", 1)
          .where("e.deleted_at", "is", null)
          .where("cv.is_consumption", "=", is_consumption)
          .select(["cv.customer_id as customer_id"])
      )
      .selectFrom("customers as c")
      .leftJoin("entities as e", "e.id", "c.customer_id")
      .where("e.deleted_at", "is", null)
      .where("e.status", "=", 1)

    if (keyword) {
      query = query.where("e.name", "like", `%${keyword}%`)
    }

    const totalEntityCustomer = await query
      .select((eb) => eb.fn.countAll().as("total"))
      .executeTakeFirst()

    return Number(totalEntityCustomer?.total) || 0
  }

  async getEntityDetail(c: Context<DB>, id: number) {
    return c.var.trx
      .selectFrom("entities as e")
      .leftJoin("provinces as p", (join) =>
        join.onRef("p.id", "=", "e.province_id").on("p.deleted_at", "is", null)
      )
      .leftJoin("regencies as r", (join) =>
        join.onRef("r.id", "=", "e.regency_id").on("r.deleted_at", "is", null)
      )
      .leftJoin("sub_districts as sd", (join) =>
        join
          .onRef("sd.id", "=", "e.sub_district_id")
          .on("sd.deleted_at", "is", null)
      )
      .leftJoin("villages as v", (join) =>
        join.onRef("v.id", "=", "e.village_id").on("v.deleted_at", "is", null)
      )
      .where("e.deleted_at", "is", null)
      .select([
        "e.id",
        "e.name",
        "e.is_vendor",
        "v.id as village_id",
        "sd.id as sub_district_id",
        "r.id as regency_id",
        "p.id as province_id",
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
    params: GetExcelFileEntitiesCustomerQueries
  ) {
    const { is_consumption } = params
    // Handle big data query using stream process
    return c.var.trx
      .with("customers", (db) =>
        db
          .selectFrom("entities as e")
          .leftJoin("customer_vendors as cv", (join) =>
            join
              .onRef("cv.vendor_id", "=", "e.id")
              .on("cv.deleted_at", "is", null)
          )
          .where("e.id", "=", id)
          .where("e.status", "=", 1)
          .where("e.deleted_at", "is", null)
          .where("cv.is_consumption", "=", is_consumption)
          .select(["cv.customer_id"])
      )
      .selectFrom("customers as c")
      .leftJoin("entities as e", (join) =>
        join.onRef("e.id", "=", "c.customer_id").on("e.deleted_at", "is", null)
      )
      .leftJoin("users as u", (join) =>
        join.onRef("u.id", "=", "e.created_by").on("u.deleted_at", "is", null)
      )
      .leftJoin("customer_has_activities as cha", (join) =>
        join
          .onRef("cha.customer_id", "=", "c.customer_id")
          .on("cha.vendor_id", "=", id)
          .on("cha.deleted_at", "is", null)
      )
      .leftJoin("master_activities as ma", (join) =>
        join
          .onRef("ma.id", "=", "cha.activity_id")
          .on("ma.deleted_at", "is", null)
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
      .stream()
  }

  async getListEntityCustomerBaseOnLocation(
    c: Context<DB>,
    params: GetEntitiesCustomersRelationQueries,
    entityDetail: EntityDetailRelationCustomerDTO,
    mapIDListCustomer: number[]
  ) {
    const { page, paginate, keyword, is_consumption } = params
    const { village_id, province_id, regency_id, sub_district_id } =
      entityDetail
    const offset = (page - 1) * paginate

    let query = c.var.trx
      .selectFrom("entities")
      .where("deleted_at", "is", null)
      .where("id", "not in", mapIDListCustomer)
      .where("is_vendor", "=", is_consumption === 1 ? 0 : 1)
      .where("status", "=", 1)
    query = this.#generateQueryWhereClause({
      query,
      keyword,
      province_id,
      regency_id,
      sub_district_id,
      village_id,
    })

    const listEntity = await query
      .select(["id", "name"])
      .limit(paginate)
      .offset(offset)
      .execute()

    return listEntity
  }

  async getTotalCountEntityCustomerBaseOnLocation(
    c: Context<DB>,
    params: GetEntitiesCustomersRelationQueries,
    entityDetail: EntityDetailRelationCustomerDTO,
    mapIDListCustomer: number[]
  ) {
    const { keyword, is_consumption } = params
    const { village_id, province_id, regency_id, sub_district_id } =
      entityDetail

    let query = c.var.trx
      .selectFrom("entities")
      .where("deleted_at", "is", null)
      .where("id", "not in", mapIDListCustomer)
      .where("is_vendor", "=", is_consumption === 1 ? 0 : 1)
      .where("status", "=", 1)
    query = this.#generateQueryWhereClause({
      query,
      keyword,
      province_id,
      regency_id,
      sub_district_id,
      village_id,
    })

    const totalEntityCustomer = await query
      .select((eb) => eb.fn.countAll().as("total"))
      .executeTakeFirst()

    return Number(totalEntityCustomer?.total) || 0
  }

  getListEntity(c: Context<DB>, listEntity: number[]) {
    return c.var.trx
      .selectFrom("entities")
      .where("deleted_at", "is", null)
      .where("status", "=", 1)
      .where("id", "in", listEntity)
      .select(["id", "is_vendor"])
      .execute()
  }

  async getListActivity(c: Context<DB>, listActivity: number[]) {
    return c.var.trx
      .selectFrom("master_activities")
      .where("id", "in", listActivity)
      .where("deleted_at", "is", null)
      .select(["id"])
      .execute()
  }

  async getEntityHasActivities(
    c: Context<DB>,
    entityID: number,
    customerID: number,
    listActivity: number[]
  ) {
    return c.var.trx
      .selectFrom("customer_has_activities")
      .where("vendor_id", "=", entityID)
      .where("customer_id", "=", customerID)
      .where("activity_id", "in", listActivity)
      .where("deleted_at", "is", null)
      .select(["customer_id", "activity_id"])
      .execute()
  }

  async insertActivities(c: Context<DB>, data: CustomerHasActivitiesDTO[]) {
    return c.var.trx
      .insertInto("customer_has_activities")
      .values(data)
      .execute()
  }

  async getListEntityActivity(
    c: Context<DB>,
    entityID: number,
    customerID: number
  ) {
    return c.var.trx
      .selectFrom("customer_has_activities")
      .where("vendor_id", "=", entityID)
      .where("customer_id", "=", customerID)
      .where("deleted_at", "is", null)
      .select(["activity_id"])
      .execute()
  }

  async deleteActivities(
    c: Context<DB>,
    entityID: number,
    customerID: number,
    activity_ids: number[]
  ) {
    let query = c.var.trx
      .updateTable("customer_has_activities")
      .set({
        deleted_at: new Date(),
      })
      .where("vendor_id", "=", entityID)
      .where("customer_id", "=", customerID)
      .where("deleted_at", "is", null)

    if (activity_ids.length > 0) {
      query = query.where("activity_id", "not in", activity_ids)
    }

    return query.executeTakeFirst()
  }

  async getListEntityCustomers(c: Context<DB>, id: number) {
    return c.var.trx
      .selectFrom("customer_vendors")
      .where("vendor_id", "=", id)
      .where("deleted_at", "is", null)
      .select(["customer_id"])
      .execute()
  }

  async getEntityCustomer(
    c: Context<DB>,
    vendorID: number,
    listCustomerID: number[]
  ) {
    return c.var.trx
      .selectFrom("customer_vendors")
      .where("vendor_id", "=", vendorID)
      .where("customer_id", "in", listCustomerID)
      .where("deleted_at", "is", null)
      .select(["customer_id", "vendor_id"])
      .execute()
  }

  async insertCustomer(c: Context<DB>, data: CustomerVendorsDTO[]) {
    return c.var.trx.insertInto("customer_vendors").values(data).execute()
  }

  async getListEntityCustomerBaseOnLocationStreamData(
    c: Context<DB>,
    entityDetail: EntityDetailRelationCustomerDTO,
    mapIDListCustomer: number[]
  ) {
    const { village_id, province_id, regency_id, sub_district_id } =
      entityDetail

    let query = c.var.trx
      .selectFrom("entities")
      .where("deleted_at", "is", null)
      .where("status", "=", 1)
      .where("id", "not in", mapIDListCustomer)
    query = this.#generateQueryWhereClause({
      query,
      province_id,
      regency_id,
      sub_district_id,
      village_id,
    })

    return query.select(["id", "name", "is_vendor"]).stream()
  }

  getListActivityStreamData(c: Context<DB>) {
    return c.var.trx
      .selectFrom("master_activities")
      .where("deleted_at", "is", null)
      .select(["id", "name"])
      .stream()
  }

  findEntityDetail(c: Context<DB>, entityID: number) {
    return c.var.trx
      .selectFrom("entities")
      .where("deleted_at", "is", null)
      .where("status", "=", 1)
      .where("id", "=", entityID)
      .select([
        "id",
        "province_id",
        "regency_id",
        "sub_district_id",
        "village_id",
      ])
      .executeTakeFirst()
  }

  async getValidateListEntityCustomerRelation(
    c: Context<DB>,
    entityDetail: EntityDetailRelationCustomerDTO,
    mapIDListCustomer: number[]
  ) {
    const { village_id, province_id, regency_id, sub_district_id } =
      entityDetail

    let query = c.var.trx
      .selectFrom("entities")
      .where("deleted_at", "is", null)
      .where("id", "not in", mapIDListCustomer)
      .where("status", "=", 1)
    query = this.#generateQueryWhereClause({
      query,
      province_id,
      regency_id,
      sub_district_id,
      village_id,
    })

    const listEntity = await query.select(["id", "name"]).execute()

    return listEntity
  }

  async getValidateListEntityActivities(c: Context<DB>, entityID: number) {
    return c.var.trx
      .selectFrom("customer_has_activities")
      .where("vendor_id", "=", entityID)
      .where("deleted_at", "is", null)
      .select(["customer_id", "activity_id"])
      .execute()
  }

  async deleteCustomerEntity(
    c: Context<DB>,
    entityID: number,
    customerID: number
  ) {
    const query = c.var.trx
      .updateTable("customer_vendors")
      .set({
        deleted_at: new Date(),
      })
      .where("vendor_id", "=", entityID)
      .where("customer_id", "=", customerID)

    return query.executeTakeFirst()
  }
}
