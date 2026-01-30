import { DB } from "@/common/infrastructure/database/types/db.js"
import { Context } from "@smile-health/lib/types/context.js"
import {
  GetDetailStockConsumptionQueries,
  GetListStockConsumptionQueries,
} from "./stock-consumption.schema.js"
import { sql } from "kysely"

export class StockConsumptionRepository {
  async getListStockMaterial(
    c: Context<DB>,
    params: GetListStockConsumptionQueries,
    programId: number
  ) {
    const { page, paginate, keyword, customer_id, vendor_id } = params
    const offset = (page - 1) * paginate
    const query = c.var.trx
      .selectFrom("ws_stock_consumptions as wssc")
      .innerJoin("ws_materials as wsmat", (join) =>
        join
          .onRef("wsmat.id", "=", "wssc.material_id")
          .on("wsmat.deleted_at", "is", null)
          .on("wsmat.program_id", "=", programId)
      )
      .innerJoin("ws_entities as wse", (join) =>
        join
          .onRef("wse.id", "=", "wssc.customer_id")
          .on("wse.deleted_at", "is", null)
          .on("wse.program_id", "=", programId)
      )
      .innerJoin("ws_activities as ws_activity", (join) =>
        join
          .onRef("ws_activity.id", "=", "wssc.activity_id")
          .on("ws_activity.program_id", "=", programId)
          .on("ws_activity.deleted_at", "is", null)
      )
      .innerJoin("ws_activities as ws_stock_activity", (join) =>
        join
          .onRef("ws_stock_activity.id", "=", "wssc.vendor_stock_activity_id")
          .on("ws_stock_activity.program_id", "=", programId)
          .on("ws_stock_activity.deleted_at", "is", null)
      )
      .leftJoin("entity_tags as et", (join) =>
        join
          .onRef("et.id", "=", "wse.entity_tag_id")
          .on("et.deleted_at", "is", null)
      )
      .leftJoin("locations as p", (join) =>
        join.onRef("p.id", "=", "wse.province_id")
      )
      .leftJoin("locations as r", (join) =>
        join.onRef("r.id", "=", "wse.regency_id")
      )
      .leftJoin("locations as sd", (join) =>
        join.onRef("sd.id", "=", "wse.sub_district_id")
      )
      .leftJoin("locations as v", (join) =>
        join.onRef("v.id", "=", "wse.village_id")
      )
      .leftJoin("ws_batches as wsb", (join) =>
        join
          .onRef("wsb.id", "=", "wssc.batch_id")
          .on("wsb.deleted_at", "is", null)
      )
      .leftJoin("ws_manufactures as wsman", (join) =>
        join
          .onRef("wsman.id", "=", "wsb.manufacture_id")
          .on("wsman.deleted_at", "is", null)
      )
      .$if(customer_id !== undefined, (qb) =>
        qb.where("wssc.customer_id", "=", customer_id!)
      )
      .$if(vendor_id !== undefined, (qb) =>
        qb.where("wssc.vendor_id", "=", vendor_id!)
      )
      .$if(keyword !== undefined, (qb) =>
        qb.where("wsmat.name", "like", `%${keyword}%`)
      )

    const [list, totalList] = await Promise.all([
      query
        .select([
          "wse.id as entity_id",
          "wse.name as entity_name",
          "wse.type as entity_type",
          "wse.address as entity_address",
          "et.title as entity_tag",
          sql<string>`CONCAT_WS(', ', v.name, sd.name, r.name, p.name)`.as(
            "location"
          ),
          "wsmat.id as material_id",
          "wsmat.name as material_name",
          "wsmat.is_temperature_sensitive",
          "wsmat.is_open_vial",
          "wsmat.is_managed_in_batch",
          "wsmat.unit_of_consumption",
          "wsmat.consumption_unit_per_distribution_unit",
          "ws_activity.name as activity_name",
          "ws_stock_activity.name as stock_activity_name",
          "wssc.activity_id as activity_id",
          "wssc.vendor_stock_activity_id as stock_activity_id",
          "wssc.vendor_stock_id as stock_id",
          sql<number>`coalesce(sum(wssc.qty), 0)`.as("stock_qty"),
          "wssc.updated_at as stock_updated_at",
          "wsb.id as batch_id",
          "wsb.code as batch_code",
          "wsb.production_date as batch_production_date",
          "wsb.expired_date as batch_expired_date",
          "wsman.id as manufacture_id",
          "wsman.name as manufacture_name",
          "wsman.address as manufacture_address",
        ])
        .limit(paginate)
        .offset(offset)
        .groupBy([
          "wsmat.id",
          "wssc.activity_id",
          "wssc.vendor_stock_activity_id",
        ])
        .execute(),
      query.select((eb) => eb.fn.countAll().as("total")).executeTakeFirst(),
    ])

    return {
      list,
      total: Number(totalList?.total) || 0,
    }
  }

  async getDetailStockMaterial(
    c: Context<DB>,
    params: GetDetailStockConsumptionQueries,
    programId: number
  ) {
    const { customer_id, material_id, vendor_id } = params
    const query = await c.var.trx
      .selectFrom("ws_stock_consumptions as wssc")
      .innerJoin("ws_materials as wsmat", (join) =>
        join
          .onRef("wsmat.id", "=", "wssc.material_id")
          .on("wsmat.deleted_at", "is", null)
          .on("wsmat.program_id", "=", programId)
          .on("wsmat.id", "=", material_id)
      )
      .innerJoin("ws_activities as ws_activity", (join) =>
        join
          .onRef("ws_activity.id", "=", "wssc.activity_id")
          .on("ws_activity.program_id", "=", programId)
          .on("ws_activity.deleted_at", "is", null)
      )
      .innerJoin("ws_activities as ws_stock_activity", (join) =>
        join
          .onRef("ws_stock_activity.id", "=", "wssc.vendor_stock_activity_id")
          .on("ws_stock_activity.program_id", "=", programId)
          .on("ws_stock_activity.deleted_at", "is", null)
      )
      .leftJoin("ws_batches as wsb", (join) =>
        join
          .onRef("wsb.id", "=", "wssc.batch_id")
          .on("wsb.deleted_at", "is", null)
      )
      .leftJoin("ws_manufactures as wsman", (join) =>
        join
          .onRef("wsman.id", "=", "wsb.manufacture_id")
          .on("wsman.deleted_at", "is", null)
      )
      .where("wssc.customer_id", "=", customer_id)
      .where("wssc.vendor_id", "=", vendor_id)
      .select([
        "wsmat.id as material_id",
        "wsmat.name as material_name",
        "wsmat.is_temperature_sensitive",
        "wsmat.is_open_vial",
        "wsmat.is_managed_in_batch",
        "wsmat.unit_of_consumption",
        "wsmat.consumption_unit_per_distribution_unit",
        "ws_stock_activity.name as stock_activity_name",
        "wssc.vendor_stock_activity_id as stock_activity_id",
        "wssc.vendor_stock_id as stock_id",
        "wssc.qty as stock_qty",
        "wssc.updated_at as stock_updated_at",
        "wsb.id as batch_id",
        "wsb.code as batch_code",
        "wsb.production_date as batch_production_date",
        "wsb.expired_date as batch_expired_date",
        "wsman.id as manufacture_id",
        "wsman.name as manufacture_name",
        "wsman.address as manufacture_address",
      ])
      .execute()

    return query
  }
}
