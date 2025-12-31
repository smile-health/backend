import { DB } from "@/common/infrastructure/database/types/db.js"
import { Context } from "@smile/lib/types/context.js"
import { sql } from "kysely"
import { GetEntitiesVendorsQueries } from "./entity-vendor.schema.js"

export class EntityVendorRepository {
  async getListEntityVendor(
    c: Context<DB>,
    id: number,
    params: GetEntitiesVendorsQueries
  ) {
    const { page, paginate, keyword } = params
    const offset = (page - 1) * paginate
    let query = c.var.trx
      .with("vendors", (db) =>
        db
          .selectFrom("entities as e")
          .leftJoin("customer_vendors as cv", (join) =>
            join
              .onRef("cv.customer_id", "=", "e.id")
              .on("cv.deleted_at", "is", null)
          )
          .where("e.id", "=", id)
          .where("e.status", "=", 1)
          .where("e.deleted_at", "is", null)
          .select(["cv.vendor_id as id"])
      )
      .selectFrom("vendors as ven")
      .leftJoin("entities as e", (join) =>
        join.onRef("e.id", "=", "ven.id").on("e.deleted_at", "is", null)
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
      .leftJoin("villages as vil", (join) =>
        join
          .onRef("vil.id", "=", "e.village_id")
          .on("vil.deleted_at", "is", null)
      )
      .leftJoin("entity_activity_date as ead", (join) =>
        join
          .onRef("ead.entity_id", "=", "e.id")
          .on("ead.deleted_at", "is", null)
      )
      .leftJoin("master_activities as ma", (join) =>
        join
          .onRef("ma.id", "=", "ead.activity_id")
          .on("ma.deleted_at", "is", null)
      )
      .select([
        "ven.id",
        "e.name",
        "e.address",
        sql<string>`CONCAT_WS(', ', vil.name, sd.name, r.name, p.name)`.as(
          "location"
        ),
        sql<string>`GROUP_CONCAT(ma.name SEPARATOR ', ')`.as("activity"),
      ])

    if (keyword) {
      query = query.where("e.name", "like", `%${keyword}%`)
    }

    const listEntity = await query
      .groupBy("ven.id")
      .limit(paginate)
      .offset(offset)
      .execute()
    return listEntity
  }

  async getTotalCountEntityVendor(
    c: Context<DB>,
    id: number,
    params: GetEntitiesVendorsQueries
  ) {
    const { keyword } = params

    let query = c.var.trx
      .with("vendors", (db) =>
        db
          .selectFrom("entities as e")
          .leftJoin("customer_vendors as cv", (join) =>
            join
              .onRef("cv.customer_id", "=", "e.id")
              .on("cv.deleted_at", "is", null)
          )
          .where("e.id", "=", id)
          .where("e.status", "=", 1)
          .where("e.deleted_at", "is", null)
          .select(["cv.vendor_id as id"])
      )
      .selectFrom("vendors as v")
      .leftJoin("entities as e", (join) =>
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
}
