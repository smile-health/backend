import { IS_RELOCATION, IS_VENDOR } from "@/common/constants/order.js"
import { db } from "@/common/infrastructure/database/index.js"
import { DB } from "@/common/infrastructure/database/types/db.js"
import { Context } from "@smile-health/lib/types/context.js"
import { Context as CtxHono } from "hono"
import { CompiledQuery, sql } from "kysely"
import { ListCustomerVendorActivityDTO } from "../app-mobile-data/app-mobile-data.schema.js"
import { GetEntitiesVendorsQueries } from "./entity-vendor.schema.js"

export class EntityVendorRepository {
  async getListEntityVendor(
    c: Context<DB>,
    id: number,
    params: GetEntitiesVendorsQueries,
    programId: number
  ) {
    const { query, paginate, offset } = this.#generateListEntityVendorQuery(
      c,
      id,
      params,
      programId
    )

    const listEntity = await query
      .groupBy("ven.id")
      .limit(paginate)
      .offset(offset)
      .execute()

    return listEntity
  }

  async getListEntityVendorSameLevel(
    c: Context<DB>,
    id: number,
    params: GetEntitiesVendorsQueries,
    programId: number,
    country?: string,
    provinceId?: number,
    regencyId?: number,
    subDistrictId?: number,
    isPaginate: boolean = true
  ) {
    const { page, paginate, keyword, activity_id } = params
    const offset = (page - 1) * paginate

    let query = c.var.trx
      .selectFrom("ws_entities as e")
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
      .leftJoin("ws_entity_activities as ead", (join) =>
        join
          .onRef("ead.entity_id", "=", "e.id")
          .on("ead.deleted_at", "is", null)
      )
      .leftJoin("ws_activities as ma", (join) =>
        join
          .onRef("ma.id", "=", "ead.activity_id")
          .on("ma.deleted_at", "is", null)
          .on("ma.program_id", "=", programId)
      )

    // For Province
    if (provinceId && !regencyId && !subDistrictId) {
      query = query
        .where("e.country", "=", country ?? "ID")
        .where((eb) => {
          return eb.or([
            eb("e.province_id", "is not", null),
            eb("e.province_id", "!=", ""),
          ])
        })

        .where((eb) => {
          return eb.or([
            eb("e.regency_id", "is", null),
            eb("e.regency_id", "=", ""),
          ])
        })
    }

    // For Regency
    if (provinceId && regencyId && !subDistrictId) {
      query = query
        .where("e.province_id", "=", `${provinceId}`)
        .where((eb) => {
          return eb.or([
            eb("e.regency_id", "is not", null),
            eb("e.regency_id", "!=", ""),
          ])
        })
        .where((eb) => {
          return eb.or([
            eb("e.sub_district_id", "is", null),
            eb("e.sub_district_id", "=", ""),
          ])
        })
    }

    // For Sub District
    if (provinceId && regencyId && subDistrictId) {
      query = query
        .where("e.province_id", "=", `${provinceId}`)
        .where("e.regency_id", "=", `${regencyId}`)
        .where((eb) => {
          return eb.or([
            eb("e.sub_district_id", "is not", null),
            eb("e.sub_district_id", "!=", ""),
          ])
        })
    }

    if (keyword) {
      query = query.where((eb) =>
        eb.or([
          eb("e.name", "like", `%${keyword}%`),
          eb("e.address", "like", `%${keyword}%`),
        ])
      )
    }

    const result = query
      .where("e.program_id", "=", programId)
      .$if(activity_id != undefined, (qb) =>
        qb.where("ma.id", "=", activity_id ?? 0)
      )
      .where("e.id", "!=", id)
      .where("e.is_vendor", "=", IS_VENDOR.TRUE)
      .where("e.is_relocation", "=", IS_RELOCATION.TRUE)
      .groupBy("e.id")
      .select([
        "e.id",
        "e.name",
        "e.address",
        sql<string>`CONCAT_WS(', ', v.name, sd.name, r.name, p.name)`.as(
          "location"
        ),
        sql<string>`GROUP_CONCAT(ma.name SEPARATOR ', ')`.as("activity"),
      ])

    // condition needed in app-data/cv-relocaltion
    if (isPaginate) {
      return await result.limit(paginate).offset(offset).execute()
    }

    return await result.execute()
  }

  async getEntityById(c: Context<DB>, id: number, programId: number) {
    return await c.var.trx
      .selectFrom("ws_entities")
      .selectAll()
      .where("id", "=", id)
      .where("program_id", "=", programId)
      .where("deleted_at", "is", null)
      .executeTakeFirst()
  }

  async getListEntityVendorWithoutPagination(
    c: Context<DB>,
    id: number,
    params: GetEntitiesVendorsQueries,
    programId: number
  ) {
    const { query } = this.#generateListEntityVendorQuery(
      c,
      id,
      params,
      programId
    )

    const listEntity = await query.groupBy("ven.id").execute()
    return listEntity
  }

  async getTotalCountEntityVendor(
    c: Context<DB>,
    id: number,
    params: GetEntitiesVendorsQueries,
    programId: number
  ) {
    const { keyword } = params

    let query = c.var.trx
      .with("vendors", (db) =>
        db
          .selectFrom("ws_entities as e")
          .leftJoin("ws_customer_vendors as cv", (join) =>
            join
              .onRef("cv.customer_id", "=", "e.id")
              .on("cv.deleted_at", "is", null)
              .on("cv.program_id", "=", programId)
          )
          .where("e.id", "=", id)
          .where("e.status", "=", 1)
          .where("e.deleted_at", "is", null)
          .where("e.program_id", "=", programId)
          .select(["cv.vendor_id as id"])
      )
      .selectFrom("vendors as v")
      .leftJoin("ws_entities as e", (join) =>
        join.onRef("e.id", "=", "v.id").on("e.deleted_at", "is", null)
      )

    if (keyword) {
      query = query.where("e.name", "like", `%${keyword}%`)
    }

    const totalEntityVendor = await query
      .select((eb) => eb.fn.countAll().as("total"))
      .executeTakeFirst()

    return Number(totalEntityVendor?.total) || 0
  }

  async getVendorsEntityTag(c: CtxHono, entityId?: number) {
    const { rows } = await db.executeQuery(
      CompiledQuery.raw("select get_vendors_entityTag(?, ?) as result", [
        c.var.programId,
        entityId ?? c.var.entityId,
      ])
    )

    return rows[0] as {
      result: Pick<ListCustomerVendorActivityDTO, "vendors">
    }
  }

  #generateListEntityVendorQuery(
    c: Context<DB>,
    id: number,
    params: GetEntitiesVendorsQueries,
    programId: number
  ) {
    const { page, paginate, keyword } = params
    const offset = (page - 1) * paginate

    let query = c.var.trx
      .with("vendors", (db) =>
        db
          .selectFrom("ws_entities as e")
          .leftJoin("ws_customer_vendors as cv", (join) =>
            join
              .onRef("cv.customer_id", "=", "e.id")
              .on("cv.deleted_at", "is", null)
              .on("cv.program_id", "=", programId)
          )
          .where("e.id", "=", id)
          .where("e.status", "=", 1)
          .where("e.deleted_at", "is", null)
          .where("e.program_id", "=", programId)
          .select(["cv.vendor_id as id", "e.is_vendor as is_vendor"])
      )
      .selectFrom("vendors as ven")
      .innerJoin("ws_entities as e", (join) =>
        join.onRef("e.id", "=", "ven.id").on("e.deleted_at", "is", null)
      )
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
      .leftJoin("ws_entity_activities as ead", (join) =>
        join
          .onRef("ead.entity_id", "=", "e.id")
          .on("ead.deleted_at", "is", null)
      )
      .leftJoin("ws_activities as ma", (join) =>
        join
          .onRef("ma.id", "=", "ead.activity_id")
          .on("ma.deleted_at", "is", null)
          .on("ma.program_id", "=", programId)
      )
      .where("e.is_vendor", "=", 1)
      .select([
        "e.id",
        sql`COUNT(*)`.as("entity_count"),
        "e.name",
        "e.address",
        sql<string>`CONCAT_WS(', ', v.name, sd.name, r.name, p.name)`.as(
          "location"
        ),
        sql<string>`GROUP_CONCAT(ma.name SEPARATOR ', ')`.as("activity"),
      ])

    if (keyword) {
      query = query.where("e.name", "like", `%${keyword}%`)
    }

    return { query, paginate, offset }
  }
}
