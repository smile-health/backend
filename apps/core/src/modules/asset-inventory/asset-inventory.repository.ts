/* eslint-disable @typescript-eslint/no-explicit-any */
import { ASSET_CLASSIFICATION } from "@/common/constants/assets.js"
import { FLAG } from "@/common/constants/general.js"
import { DB } from "@/common/infrastructure/database/types/db.js"
import { CustomContext } from "@smile/lib/types/context.js"
import { associate, collect, differ, group } from "@smile/lib/utils.js"
import { Context } from "hono"
import { Insertable, sql } from "kysely"
import { BaseRepository } from "../base.repository.js"
import { GetAssetInventoryQueryParams } from "./asset-inventory.schema.js"

type ContactPersons = DB["contact_persons"]

export class AssetInventoryRepository extends BaseRepository<"asset_inventories"> {
  constructor() {
    super("asset_inventories")
  }

  async getMapTemperatureData(c: Context, assetModelIds: number[]) {
    if (assetModelIds.length === 0) return {}

    const temperatureCapacities = await c.var.trx
      .selectFrom("asset_models_temperatures_capacities as amtc")
      .innerJoin("asset_types_temperatures as att", (join) =>
        join.onRef("amtc.asset_type_temperature_id", "=", "att.id")
      )
      .innerJoin("temperature_thresholds as tt", (join) =>
        join.onRef("att.temperature_threshold_id", "=", "tt.id")
      )
      .select([
        "amtc.asset_model_id",
        "amtc.gross_capacity",
        "amtc.net_capacity",
        "tt.min_temperature",
        "tt.max_temperature",
      ])
      .where("amtc.asset_model_id", "in", assetModelIds)
      .where("amtc.deleted_at", "is", null)
      .orderBy("tt.min_temperature", "desc")
      .execute()

    const mapData = group(temperatureCapacities, "asset_model_id")
    const temperatureAssetModelIds = Object.keys(mapData).map(Number)
    const nonTemperatureAssetModelIds = differ(
      assetModelIds,
      temperatureAssetModelIds
    )

    if (nonTemperatureAssetModelIds.length === 0) return mapData

    const nonTemperatureCapacities = await c.var.trx
      .selectFrom("asset_models_non_temperatures_capacities")
      .select(["asset_model_id", "gross_capacity", "net_capacity"])
      .where("asset_model_id", "in", nonTemperatureAssetModelIds)
      .where("deleted_at", "is", null)
      .orderBy("gross_capacity", "asc")
      .execute()

    return nonTemperatureCapacities.reduce((acc, capacity) => {
      acc[capacity.asset_model_id]?.push({
        asset_model_id: capacity.asset_model_id,
        gross_capacity: capacity.gross_capacity,
        net_capacity: capacity.net_capacity,
        min_temperature: null,
        max_temperature: null,
      })
      return acc
    }, mapData)
  }

  async getMapRtmdData(c: Context, assetInventoryIds: number[]) {
    if (assetInventoryIds.length === 0) return {}

    const result = await c.var.trx
      .with("latest_history", (db) =>
        db.selectFrom("asset_rtmd_histories as arh").select([
          "arh.asset_rtmd_id",
          "arh.temperature",
          "arh.created_at",
          sql<number>`ROW_NUMBER() OVER (
            PARTITION BY arh.asset_rtmd_id
            ORDER BY arh.created_at DESC
          )`.as("rn"),
        ])
      )
      .selectFrom("asset_inventory_rtmds as air")
      .innerJoin("asset_rtmds as ar", "ar.id", "air.asset_rtmd_id")
      .leftJoin("asset_models as am", "ar.asset_model_id", "am.id")
      .leftJoin("manufactures as m", "ar.manufacture_id", "m.id")
      .leftJoin("latest_history as lh", (join) =>
        join
          .onRef("lh.asset_rtmd_id", "=", "air.asset_rtmd_id")
          .on("lh.rn", "=", sql.lit(1))
      )
      .select([
        "air.asset_inventory_id",
        "ar.serial_number",
        "am.name as model_name",
        "m.name as manufacture_name",
        "lh.temperature",
        "lh.created_at",
      ])
      .where("air.asset_inventory_id", "in", assetInventoryIds)
      .groupBy("air.asset_inventory_id")
      .execute()

    return associate(result, "asset_inventory_id")
  }

  async getMapRtmdDataAsArray(c: Context, assetInventoryIds: number[]) {
    if (assetInventoryIds.length === 0) return {}

    const result = await c.var.trx
      .with("latest_history", (db) =>
        db.selectFrom("asset_rtmd_histories as arh").select([
          "arh.asset_rtmd_id",
          "arh.temperature",
          "arh.created_at",
          sql<number>`ROW_NUMBER() OVER (
              PARTITION BY arh.asset_rtmd_id
              ORDER BY arh.created_at DESC
            )`.as("rn"),
        ])
      )
      .selectFrom("asset_inventory_rtmds as air")
      .innerJoin("asset_rtmds as ar", "ar.id", "air.asset_rtmd_id")
      .leftJoin("asset_models as am", "ar.asset_model_id", "am.id")
      .leftJoin("manufactures as m", "ar.manufacture_id", "m.id")
      .leftJoin("latest_history as lh", (join) =>
        join
          .onRef("lh.asset_rtmd_id", "=", "air.asset_rtmd_id")
          .on("lh.rn", "=", sql.lit(1))
      )
      .select([
        "air.asset_inventory_id",
        "ar.serial_number",
        "am.name as model_name",
        "m.name as manufacture_name",
        "lh.temperature",
        "lh.created_at",
      ])
      .where("air.asset_inventory_id", "in", assetInventoryIds)
      .orderBy("air.asset_inventory_id")
      .orderBy("ar.serial_number")
      .execute()

    const groupedResult: {
      [key: number]: Array<{
        serial_number: string | null
        model_name: string | null
        manufacture_name: string | null
        temperature: number | null
        created_at: Date | null
      }>
    } = {}

    for (const row of result) {
      const assetId = row.asset_inventory_id
      if (!groupedResult[assetId]) {
        groupedResult[assetId] = []
      }
      groupedResult[assetId].push({
        serial_number: row.serial_number,
        model_name: row.model_name,
        manufacture_name: row.manufacture_name,
        temperature: row.temperature,
        created_at: row.created_at,
      })
    }

    return groupedResult
  }

  async getAssetInventoryById(c: Context, id: number) {
    const assetInventory = await c.var.trx
      .selectFrom("asset_inventories as wai")
      .innerJoin("entities as we", (join) =>
        join.onRef("wai.entity_id", "=", "we.id")
      )
      .innerJoin("entity_tags as et", (join) =>
        join.onRef("we.entity_tag_id", "=", "et.id")
      )
      .innerJoin("users as wuc", (join) =>
        join.onRef("wai.created_by", "=", "wuc.id")
      )
      .innerJoin("users as wuu", (join) =>
        join.onRef("wai.updated_by", "=", "wuu.id")
      )
      .leftJoin("locations as lp", (join) =>
        join.onRef("we.province_id", "=", "lp.id")
      )
      .leftJoin("locations as lr", (join) =>
        join.onRef("we.regency_id", "=", "lr.id")
      )
      .leftJoin("locations as lsd", (join) =>
        join.onRef("we.sub_district_id", "=", "lsd.id")
      )
      .leftJoin("locations as lv", (join) =>
        join.onRef("we.village_id", "=", "lv.id")
      )
      .leftJoin("asset_models as wam", (join) =>
        join.onRef("wai.asset_model_id", "=", "wam.id")
      )
      .leftJoin("asset_types as wat", (join) =>
        join.onRef("wai.asset_type_id", "=", "wat.id")
      )
      .leftJoin("pqs_codes as pc", (join) =>
        join.onRef("wam.pqs_code_id", "=", "pc.id")
      )
      .leftJoin("manufactures as wm", (join) =>
        join.onRef("wai.manufacture_id", "=", "wm.id")
      )
      .leftJoin("asset_working_statuses as waws", (join) =>
        join.onRef("wai.working_status_id", "=", "waws.id")
      )
      .leftJoin("budget_sources as wbs", (join) =>
        join.onRef("wai.budget_source_id", "=", "wbs.id")
      )
      .leftJoin("entities as web", (join) =>
        join.onRef("wai.borrowed_from_entity_id", "=", "web.id")
      )
      .leftJoin("asset_vendors as wavw", (join) =>
        join.onRef("wai.warranty_asset_vendor_id", "=", "wavw.id")
      )
      .leftJoin("asset_calibration_schedules as wacs", (join) =>
        join.onRef("wai.calibration_schedule_id", "=", "wacs.id")
      )
      .leftJoin("asset_vendors as wavc", (join) =>
        join.onRef("wai.calibration_asset_vendor_id", "=", "wavc.id")
      )
      .leftJoin("asset_maintenance_schedules as wams", (join) =>
        join.onRef("wai.maintenance_schedule_id", "=", "wams.id")
      )
      .leftJoin("asset_vendors as wavm", (join) =>
        join.onRef("wai.maintenance_asset_vendor_id", "=", "wavm.id")
      )
      .leftJoin("asset_electricities as wac", (join) =>
        join.onRef("wai.electricity_id", "=", "wac.id")
      )
      .leftJoin("asset_inventory_other_capacities as waoc", (join) =>
        join.onRef("wai.id", "=", "waoc.asset_inventory_id")
      )
      .select([
        "wai.id",
        "wai.electricity_id as asset_electricity_id",
        "wac.name as asset_electricity_name",
        "wai.asset_model_id",
        "wam.name as asset_model_name",
        "wai.asset_type_id",
        "wat.name as asset_type_name",
        "wai.working_status_id",
        "waws.name as asset_working_status_name",
        "wai.borrowed_from_entity_id",
        "web.name as borrowed_from_entity_name",
        "wai.budget_source_id",
        "wbs.name as budget_source_name",
        "wai.budget_year",
        "wai.calibration_asset_vendor_id",
        "wavc.name as calibration_asset_vendor_name",
        "wai.calibration_last_date",
        "wai.calibration_schedule_id",
        "wacs.name as calibration_schedule_name",
        "wai.entity_id",
        "we.name as entity_name",
        "we.is_puskesmas as entity_is_puskesmas",
        "we.entity_tag_id",
        "et.title as entity_tag_title",
        "we.province_id",
        "lp.name as province_name",
        "we.regency_id",
        "lr.name as regency_name",
        "we.sub_district_id",
        "lsd.name as sub_district_name",
        "we.village_id",
        "lv.name as village_name",
        "wai.maintenance_asset_vendor_id",
        "wavm.name as maintenance_asset_vendor_name",
        "wai.maintenance_last_date",
        "wai.maintenance_schedule_id",
        "wams.name as maintenance_schedule_name",
        "wai.manufacture_id",
        "wm.name as manufacture_name",
        "wai.ownership_qty",
        "wai.ownership_status",
        "wai.production_year",
        "wai.serial_number",
        "wai.status",
        "wai.warranty_asset_vendor_id",
        "wavw.name as warranty_asset_vendor_name",
        "wai.warranty_end_date",
        "wai.warranty_start_date",
        "wai.other_asset_model_name",
        "wai.other_asset_type_name",
        "wai.other_asset_manufacture_name",
        "wai.other_asset_budget_source_name",
        "wai.other_borrowed_from_entity_name",
        "waoc.gross as other_gross_capacity",
        "waoc.net as other_net_capacity",
        "waoc.max_temperature as other_max_temperature",
        "waoc.min_temperature as other_min_temperature",
        "pc.id as pqs_code_id",
        "pc.code as pqs_code_code",

        "wuc.id as user_created_id",
        "wuc.username as user_created_username",
        "wuc.firstname as user_created_firstname",
        "wuc.lastname as user_created_lastname",
        sql<string>`TRIM(CONCAT_WS(' ',COALESCE(CAST(${sql.ref("wuc.firstname")} AS CHAR), ''),COALESCE(CAST(${sql.ref("wuc.lastname")} AS CHAR), '')))`.as(
          "user_created_fullname"
        ),
        "wuu.id as user_updated_id",
        "wuu.username as user_updated_username",
        "wuu.firstname as user_updated_firstname",
        "wuu.lastname as user_updated_lastname",
        sql<string>`TRIM(CONCAT_WS(' ',COALESCE(CAST(${sql.ref("wuu.firstname")} AS CHAR), ''),COALESCE(CAST(${sql.ref("wuu.lastname")} AS CHAR), '')))`.as(
          "user_updated_fullname"
        ),
        "wai.created_at",
        "wai.updated_at",
        "wai.asset_model_temperature_capacity_id",
      ])
      .where("wai.id", "=", id)
      .where("wai.deleted_at", "is", null)
      .executeTakeFirst()

    if (!assetInventory) return null

    // Get temperature capacities data
    const temperatureCapacities = await c.var.trx
      .selectFrom("asset_models_temperatures_capacities as amtc")
      .innerJoin("asset_types_temperatures as att", (join) =>
        join.onRef("amtc.asset_type_temperature_id", "=", "att.id")
      )
      .innerJoin("temperature_thresholds as tt", (join) =>
        join.onRef("att.temperature_threshold_id", "=", "tt.id")
      )
      .select([
        "amtc.id",
        "amtc.gross_capacity",
        "amtc.net_capacity",
        "tt.min_temperature",
        "tt.max_temperature",
      ])
      .where("amtc.asset_model_id", "=", assetInventory.asset_model_id)
      .where("amtc.deleted_at", "is", null)
      .orderBy("tt.min_temperature", "desc")
      .execute()

    // If temperature capacities exist, use them for both capacities and temperature_thresholds
    if (temperatureCapacities.length > 0) {
      return {
        ...assetInventory,
        capacities: temperatureCapacities.map((tc) => ({
          gross_capacity: tc.gross_capacity,
          net_capacity: tc.net_capacity,
        })),
        temperature_thresholds: temperatureCapacities.map((tc) => ({
          min_temperature: tc.min_temperature,
          max_temperature: tc.max_temperature,
          is_active:
            tc.id === assetInventory.asset_model_temperature_capacity_id
              ? 1
              : 0,
        })),
      }
    }

    // If no temperature capacities, get non-temperature capacities
    const nonTemperatureCapacities = await c.var.trx
      .selectFrom("asset_models_non_temperatures_capacities")
      .select(["gross_capacity", "net_capacity"])
      .where("asset_model_id", "=", assetInventory.asset_model_id)
      .where("deleted_at", "is", null)
      .orderBy("gross_capacity", "asc")
      .execute()

    return {
      ...assetInventory,
      capacities: nonTemperatureCapacities.map((ntc) => ({
        gross_capacity: ntc.gross_capacity,
        net_capacity: ntc.net_capacity,
      })),
      temperature_thresholds: [], // Empty array when no temperature data
    }
  }

  async getListAssetInventory(
    c: Context,
    params: GetAssetInventoryQueryParams,
    entityId: number | number[]
  ) {
    const { page, paginate, sort_by, sort_type } = params
    const { client } = c.var
    const offset = (page - 1) * paginate

    let sort

    if (sort_by && sort_type) {
      if (sort_by === "name") {
        sort = [
          ["asset_model_name", sort_type],
          ["other_asset_model_name", sort_type],
          ["manufacture_name", sort_type],
          ["other_asset_manufacture_name", sort_type],
          ["serial_number", sort_type],
        ]
      } else {
        sort = [[sort_by, sort_type]]
      }
    } else {
      sort = [["updated_at", "desc"]]
    }

    const queries = c.var.trx
      .selectFrom("asset_inventories as wai")
      .innerJoin("entities as we", (join) =>
        join.onRef("wai.entity_id", "=", "we.id")
      )
      .$if(!!client, (qb) =>
        qb.innerJoin("integration_associations as ea", (join) =>
          join
            .onRef("ea.internal_id", "=", "we.id")
            .on("ea.type", "=", "entity")
            .on("ea.client_id", "=", client!.getId())
        )
      )
      .innerJoin("users as wuu", (join) =>
        join.onRef("wai.updated_by", "=", "wuu.id")
      )
      .leftJoin("locations as lp", (join) =>
        join.onRef("we.province_id", "=", "lp.id")
      )
      .leftJoin("locations as lr", (join) =>
        join.onRef("we.regency_id", "=", "lr.id")
      )
      .leftJoin("asset_models as wam", (join) =>
        join.onRef("wai.asset_model_id", "=", "wam.id")
      )
      .leftJoin("asset_types as wat", (join) =>
        join.onRef("wai.asset_type_id", "=", "wat.id")
      )
      .leftJoin("manufactures as wm", (join) =>
        join.onRef("wai.manufacture_id", "=", "wm.id")
      )
      .leftJoin("asset_working_statuses as waws", (join) =>
        join.onRef("wai.working_status_id", "=", "waws.id")
      )

    const baseQuery = this.buildFilterQuery(
      c,
      queries,
      params,
      entityId
    ).select([
      "wai.id",
      "wai.asset_model_id",
      "wam.name as asset_model_name",
      "wai.asset_type_id",
      "wat.name as asset_type_name",
      "wai.working_status_id",
      "waws.name as asset_working_status_name",
      "wai.entity_id",
      "we.name as entity_name",
      "we.is_puskesmas as entity_is_puskesmas",
      "we.province_id",
      "lp.name as province_name",
      "we.regency_id",
      "lr.name as regency_name",
      "wai.ownership_qty",
      "wai.ownership_status",
      "wai.manufacture_id",
      "wm.name as manufacture_name",
      "wai.serial_number",
      "wai.status as status_id",
      (eb) =>
        eb
          .case()
          .when(eb.ref("wai.status"), "=", eb.val(1))
          .then(eb.val("active"))
          .else(eb.val("inactive"))
          .end()
          .as("status"),
      "wuu.id as user_updated_id",
      "wuu.username as user_updated_username",
      "wuu.firstname as user_updated_firstname",
      "wuu.lastname as user_updated_lastname",
      sql<string>`TRIM(CONCAT_WS(' ',COALESCE(CAST(${sql.ref("wuu.firstname")} AS CHAR), ''),COALESCE(CAST(${sql.ref("wuu.lastname")} AS CHAR), '')))`.as(
        "user_updated_fullname"
      ),
      "wai.updated_at",
      "wai.other_asset_model_name",
      "wai.other_asset_type_name",
      "wai.other_asset_manufacture_name",
      "wai.other_asset_budget_source_name",
    ])

    const orderedQuery = sort.reduce(
      (q, [col, dir]) => q.orderBy(col as string, dir),
      baseQuery
    )

    const [list, totalList] = await Promise.all([
      orderedQuery.limit(paginate).offset(offset).execute(),
      this.buildFilterQuery(c, queries, params, entityId)
        .select((eb) => eb.fn.countAll().as("total"))
        .executeTakeFirst(),
    ])

    return {
      list: list,
      total: Number(totalList?.total) || 0,
    }
  }

  async getListAssetInventoryWithoutPaginate(
    c: Context,
    params: GetAssetInventoryQueryParams,
    entityId: number | number[]
  ) {
    const queries = c.var.trx
      .selectFrom("asset_inventories as wai")
      .innerJoin("entities as we", (join) =>
        join.onRef("wai.entity_id", "=", "we.id")
      )
      .innerJoin("entity_types as et", (join) =>
        join.onRef("we.type", "=", "et.id")
      )
      .innerJoin("users as wuu", (join) =>
        join.onRef("wai.updated_by", "=", "wuu.id")
      )
      .leftJoin("locations as lp", (join) =>
        join.onRef("we.province_id", "=", "lp.id")
      )
      .leftJoin("locations as lr", (join) =>
        join.onRef("we.regency_id", "=", "lr.id")
      )
      .leftJoin("locations as lsd", (join) =>
        join.onRef("we.sub_district_id", "=", "lsd.id")
      )
      .leftJoin("asset_models as wam", (join) =>
        join.onRef("wai.asset_model_id", "=", "wam.id")
      )
      .leftJoin("asset_types as wat", (join) =>
        join.onRef("wai.asset_type_id", "=", "wat.id")
      )
      .leftJoin("manufactures as wm", (join) =>
        join.onRef("wai.manufacture_id", "=", "wm.id")
      )
      .leftJoin("asset_working_statuses as waws", (join) =>
        join.onRef("wai.working_status_id", "=", "waws.id")
      )
      .leftJoin("budget_sources as wbs", (join) =>
        join.onRef("wai.budget_source_id", "=", "wbs.id")
      )
      .leftJoin("asset_vendors as wavw", (join) =>
        join.onRef("wai.warranty_asset_vendor_id", "=", "wavw.id")
      )
      .leftJoin("asset_calibration_schedules as wacs", (join) =>
        join.onRef("wai.calibration_schedule_id", "=", "wacs.id")
      )
      .leftJoin("asset_vendors as wavc", (join) =>
        join.onRef("wai.calibration_asset_vendor_id", "=", "wavc.id")
      )
      .leftJoin("asset_maintenance_schedules as wams", (join) =>
        join.onRef("wai.maintenance_schedule_id", "=", "wams.id")
      )
      .leftJoin("asset_vendors as wavm", (join) =>
        join.onRef("wai.maintenance_asset_vendor_id", "=", "wavm.id")
      )
      .leftJoin("asset_electricities as wac", (join) =>
        join.onRef("wai.electricity_id", "=", "wac.id")
      )
      .leftJoin("pqs_codes as pc", (join) =>
        join.onRef("wam.pqs_code_id", "=", "pc.id")
      )
      .leftJoin("pqs_types as pt", (join) =>
        join.onRef("pc.pqs_type_id", "=", "pt.id")
      )
      .leftJoin("cceigat_descriptions as cd", (join) =>
        join.onRef("pc.cceigat_description_id", "=", "cd.id")
      )
      .leftJoin("asset_inventory_other_capacities as waoc", (join) =>
        join.onRef("wai.id", "=", "waoc.asset_inventory_id")
      )

    const baseQuery = this.buildFilterQuery(c, queries, params, entityId)
      .select([
        "wai.id",
        "wai.asset_model_id",
        "wam.name as asset_model_name",
        "wai.asset_type_id",
        "wat.name as asset_type_name",
        "wai.working_status_id",
        "waws.name as asset_working_status_name",
        "wai.entity_id",
        "we.name as entity_name",
        "et.name as entity_type",
        "we.lat as entity_lat",
        "we.lng as entity_lng",
        "we.is_puskesmas as entity_is_puskesmas",
        "we.province_id",
        "lp.name as province_name",
        "we.regency_id",
        "lr.name as regency_name",
        "we.sub_district_id",
        "lsd.name as sub_district_name",
        "wai.ownership_qty",
        "wai.ownership_status",
        "wai.manufacture_id",
        "wm.name as manufacture_name",
        "wai.serial_number",
        "wai.status as status_id",
        (eb) =>
          eb
            .case()
            .when(eb.ref("wai.status"), "=", eb.val(1))
            .then(eb.val("active"))
            .else(eb.val("inactive"))
            .end()
            .as("status"),
        "wai.budget_source_id",
        "wbs.name as budget_source_name",
        "wai.budget_year",
        "wac.name as electricity_name",
        "wai.warranty_asset_vendor_id",
        "wavw.name as warranty_asset_vendor_name",
        "wai.warranty_start_date",
        "wai.warranty_end_date",
        "wai.maintenance_schedule_id",
        "wams.name as maintenance_schedule_name",
        "wai.maintenance_asset_vendor_id",
        "wavm.name as maintenance_asset_vendor_name",
        "wai.maintenance_last_date",
        "wai.calibration_schedule_id",
        "wacs.name as calibration_schedule_name",
        "wai.calibration_asset_vendor_id",
        "wavc.name as calibration_asset_vendor_name",
        "wai.calibration_last_date",
        "wuu.id as user_updated_id",
        "wuu.username as user_updated_username",
        "wuu.firstname as user_updated_firstname",
        "wuu.lastname as user_updated_lastname",
        sql<string>`TRIM(CONCAT_WS(' ',COALESCE(CAST(${sql.ref("wuu.firstname")} AS CHAR), ''),COALESCE(CAST(${sql.ref("wuu.lastname")} AS CHAR), '')))`.as(
          "user_updated_fullname"
        ),
        "wai.updated_at",
        "wai.other_asset_model_name",
        "wai.other_asset_type_name",
        "wai.other_asset_manufacture_name",
        "wai.other_asset_budget_source_name",
        "wai.other_borrowed_from_entity_name",
        "waoc.gross as other_gross_capacity",
        "waoc.net as other_net_capacity",
        "waoc.max_temperature as other_max_temperature",
        "waoc.min_temperature as other_min_temperature",
        "wai.production_year",
        "pc.code as pqs_code",
        "pt.name as pqs_type",
        "cd.name as cceigat_description",
      ])
      .orderBy("wai.updated_at", "desc")

    const rows = await baseQuery.execute()
    return rows.map((row) => ({
      ...row,
      entity_type: c.var.t(`entity_type.label.${row.entity_type}`),
    }))
  }

  private buildFilterQuery(
    c: Context,
    queries: any,
    params: GetAssetInventoryQueryParams,
    entityId: number | number[]
  ) {
    const {
      keyword,
      asset_type_ids,
      manufacture_ids,
      working_status_id,
      province_id,
      regency_id,
      health_center_id,
      entity_tag_ids,
      status,
      asset_model_ids,
      program_ids,
      is_device_related,
      is_warehouse,
      is_other,
    } = params

    queries = queries
      .where("wai.deleted_at", "is", null)
      .$if(is_device_related !== undefined, (eb) =>
        eb.where(
          "wai.id",
          is_device_related === FLAG.TRUE ? "in" : "not in",
          c.var.trx
            .selectFrom("asset_inventory_rtmds")
            .select("asset_inventory_id")
        )
      )
      .$if(is_warehouse !== undefined, (eb) =>
        eb.where(
          "wai.asset_type_id",
          is_warehouse === FLAG.TRUE ? "in" : "not in",
          c.var.trx
            .selectFrom("asset_types_classifications")
            .select("asset_type_id")
            .where(
              "asset_classifications_id",
              "=",
              ASSET_CLASSIFICATION.WAREHOUSE
            )
        )
      )
      .$if(program_ids !== undefined && program_ids.length > 0, (eb) =>
        eb.where(
          "wai.id",
          "in",
          c.var.trx
            .selectFrom("asset_inventory_workspaces")
            .select("asset_inventory_id")
            .where("workspace_id", "in", program_ids!)
        )
      )

    if (typeof entityId === "object" && entityId.length > 0) {
      queries = queries.where("wai.entity_id", "in", entityId)
    }

    if (typeof entityId === "number") {
      queries = queries.where("wai.entity_id", "=", entityId)
    }

    if (keyword) {
      queries = queries.where((eb) =>
        eb.or([
          eb("wam.name", "like", `%${keyword}%`),
          eb("wai.other_asset_model_name", "like", `%${keyword}%`),
          eb("wm.name", "like", `%${keyword}%`),
          eb("wai.other_asset_manufacture_name", "like", `%${keyword}%`),
          eb("wai.serial_number", "like", `%${keyword}%`),
        ])
      )
    }

    if (asset_type_ids) {
      queries =
        is_other === 1
          ? queries.where((eb) =>
              eb.or([
                eb("wai.asset_type_id", "in", asset_type_ids),
                eb("wai.asset_type_id", "is", null),
              ])
            )
          : queries.where("wai.asset_type_id", "in", asset_type_ids)
    } else {
      queries = queries.where(
        "wai.asset_type_id",
        is_other === FLAG.TRUE ? "is" : "is not",
        null
      )
    }

    if (manufacture_ids) {
      queries = queries.where("wai.manufacture_id", "in", manufacture_ids)
    }

    if (working_status_id) {
      queries = queries.where("wai.working_status_id", "=", working_status_id)
    }

    if (province_id) {
      queries = queries.where("lp.id", "=", province_id)
    }

    if (regency_id) {
      queries = queries.where("lr.id", "=", regency_id)
    }

    if (health_center_id) {
      queries = queries.where("we.id", "=", health_center_id)
    }

    if (entity_tag_ids) {
      queries = queries.where("we.entity_tag_id", "in", entity_tag_ids)
    }

    if (status === 0 || status === 1) {
      queries = queries.where("wai.status", "=", status)
    }

    if (asset_model_ids) {
      queries = queries.where("wai.asset_model_id", "in", asset_model_ids)
    }

    return queries
  }

  async getOnlyAssetInventoryById(c: Context, id: number) {
    return await c.var.trx
      .selectFrom("asset_inventories")
      .selectAll()
      .where("id", "=", id)
      .where("deleted_at", "is", null)
      .executeTakeFirst()
  }

  async getOnlyAssetInventoryBySerialNumber(c: Context, serialNumber: string) {
    return await c.var.trx
      .selectFrom("asset_inventories")
      .select(["id"])
      .where("serial_number", "=", serialNumber)
      .where("deleted_at", "is", null)
      .executeTakeFirst()
  }

  async getAssetElectricityById(c: Context, id: number) {
    return await c.var.trx
      .selectFrom("asset_electricities")
      .select(["id"])
      .where("id", "=", id)
      .where("deleted_at", "is", null)
      .executeTakeFirst()
  }

  async getAssetModelById(c: Context, id: number) {
    return await c.var.trx
      .selectFrom("asset_models")
      .select(["id"])
      .where("id", "=", id)
      .where("deleted_at", "is", null)
      .executeTakeFirst()
  }

  async getAssetTypeById(c: Context, id: number) {
    return await c.var.trx
      .selectFrom("asset_types")
      .select(["id", "name"])
      .where("id", "=", id)
      .where("deleted_at", "is", null)
      .executeTakeFirst()
  }

  async getAssetWorkingStatusById(c: Context, id: number) {
    return await c.var.trx
      .selectFrom("asset_working_statuses")
      .select(["id"])
      .where("id", "=", id)
      .where("deleted_at", "is", null)
      .executeTakeFirst()
  }

  async getBudgetSourceById(c: Context, id: number) {
    return await c.var.trx
      .selectFrom("budget_sources")
      .select(["id"])
      .where("id", "=", id)
      .where("deleted_at", "is", null)
      .executeTakeFirst()
  }

  async getAssetVendorByCalibrationVendorId(
    c: Context,
    calibrationVendorId: number
  ) {
    return await c.var.trx
      .selectFrom("asset_vendors")
      .select(["id"])
      .where("id", "=", calibrationVendorId)
      .where("deleted_at", "is", null)
      .executeTakeFirst()
  }

  async getAssetCalibrationScheduleById(c: Context, id: number) {
    return await c.var.trx
      .selectFrom("asset_calibration_schedules")
      .select(["id"])
      .where("id", "=", id)
      .where("deleted_at", "is", null)
      .executeTakeFirst()
  }

  async getAssetVendorByMaintenanceVendorId(
    c: Context,
    maintenanceVendorId: number
  ) {
    return await c.var.trx
      .selectFrom("asset_vendors")
      .select(["id"])
      .where("id", "=", maintenanceVendorId)
      .where("deleted_at", "is", null)
      .executeTakeFirst()
  }

  async getAssetMaintenanceScheduleById(c: Context, id: number) {
    return await c.var.trx
      .selectFrom("asset_maintenance_schedules")
      .select(["id"])
      .where("id", "=", id)
      .where("deleted_at", "is", null)
      .executeTakeFirst()
  }

  async getManufactureById(c: Context, id: number) {
    return await c.var.trx
      .selectFrom("manufactures")
      .select(["id"])
      .where("id", "=", id)
      .where("deleted_at", "is", null)
      .executeTakeFirst()
  }

  async getAssetVendorByWarrantyVendorId(c: Context, warrantyVendorId: number) {
    return await c.var.trx
      .selectFrom("asset_vendors")
      .select(["id"])
      .where("id", "=", warrantyVendorId)
      .where("deleted_at", "is", null)
      .executeTakeFirst()
  }

  async getEntityById(c: Context, id: number) {
    return await c.var.trx
      .selectFrom("entities as e")
      .leftJoin("integration_associations as ia", (join) =>
        join.onRef("e.id", "=", "ia.internal_id").on("ia.type", "=", "entity")
      )
      .select([
        "e.id",
        "e.province_id",
        "e.regency_id",
        "e.sub_district_id",
        "e.type",
        "e.is_puskesmas",
        "ia.client_id",
      ])
      .where("e.id", "=", id)
      .where("e.deleted_at", "is", null)
      .executeTakeFirstOrThrow()
  }

  async getPermittedProvinces(c: Context) {
    return await c.var.trx
      .selectFrom("locations")
      .select(["id"])
      .where("level", "=", 0)
      .execute()
  }

  async getPermittedRegencies(c: Context, provinceId: number) {
    return await c.var.trx
      .selectFrom("locations")
      .select(["id"])
      .where("parent_id", "=", provinceId)
      .execute()
  }

  async getPermittedSubDistricts(c: Context, provinceId: number) {
    return await c.var.trx
      .selectFrom("locations")
      .select(["id"])
      .where(
        "parent_id",
        "in",
        c.var.trx
          .selectFrom("locations")
          .select("id")
          .where("parent_id", "=", provinceId)
      )
      .execute()
  }

  async getPermittedLendingEntitiesByProvinces(c: Context, provinceIds) {
    return await c.var.trx
      .selectFrom("entities")
      .select(["id"])
      .where("province_id", "in", provinceIds)
      .where("regency_id", "is", null)
      .where("sub_district_id", "is", null)
      .where("type", "=", 1)
      .where("deleted_at", "is", null)
      .execute()
  }

  async getPermittedLendingEntitiesByRegencies(
    c: Context,
    provinceId,
    regencyIds
  ) {
    return await c.var.trx
      .selectFrom("entities")
      .select(["id"])
      .where("province_id", "=", provinceId)
      .where((eb) =>
        eb.or([
          eb.and([
            eb("regency_id", "in", regencyIds),
            eb("sub_district_id", "is", null),
            eb("type", "=", 2),
          ]),
          eb.and([
            eb("regency_id", "is", null),
            eb("sub_district_id", "is", null),
            eb("type", "=", 1),
          ]),
        ])
      )
      .where("deleted_at", "is", null)
      .execute()
  }

  async getPermittedLendingEntitiesBySubDistricts(
    c: Context,
    provinceId,
    regencyId,
    subDistrictIds
  ) {
    return await c.var.trx
      .selectFrom("entities")
      .select(["id"])
      .where("province_id", "=", provinceId)
      .where((eb) =>
        eb.or([
          eb.and([
            eb("sub_district_id", "in", subDistrictIds),
            eb("type", "=", 3),
            eb("is_puskesmas", "=", 1),
          ]),
          eb.and([
            eb("regency_id", "=", regencyId),
            eb("sub_district_id", "is", null),
            eb("type", "=", 2),
          ]),
        ])
      )
      .where("deleted_at", "is", null)
      .execute()
  }

  async getEntityByProvince(c: Context, provinceId: string) {
    return await c.var.trx
      .selectFrom("entities")
      .select(["id"])
      .where((eb) =>
        eb.or([
          eb.and([
            eb("province_id", "=", provinceId),
            eb("regency_id", "is", null),
            eb("sub_district_id", "is", null),
            eb("village_id", "is", null),
            eb("type", "=", 1),
            eb("is_puskesmas", "=", 0),
          ]),
          eb.and([
            eb("province_id", "=", provinceId),
            eb("sub_district_id", "is", null),
            eb("village_id", "is", null),
            eb("type", "=", 2),
            eb("is_puskesmas", "=", 0),
          ]),
          eb.and([
            eb("province_id", "=", provinceId),
            eb("village_id", "is", null),
            eb("type", "=", 3),
            eb("is_puskesmas", "=", 1),
          ]),
        ])
      )
      .where("deleted_at", "is", null)
      .execute()
  }

  async getEntityByRegency(c: Context, regencyId: string) {
    return await c.var.trx
      .selectFrom("entities")
      .select(["id"])
      .where((eb) =>
        eb.or([
          eb.and([
            eb("regency_id", "=", regencyId),
            eb("sub_district_id", "is", null),
            eb("village_id", "is", null),
            eb("type", "=", 2),
            eb("is_puskesmas", "=", 0),
          ]),
          eb.and([
            eb("regency_id", "=", regencyId),
            eb("village_id", "is", null),
            eb("type", "=", 3),
            eb("is_puskesmas", "=", 1),
          ]),
        ])
      )
      .where("deleted_at", "is", null)
      .execute()
  }

  private baseQueryAsset(c: CustomContext<DB>) {
    return c.var.trx
      .selectFrom("asset_inventories as wai")
      .innerJoin("entities as we", (join) =>
        join.onRef("wai.entity_id", "=", "we.id")
      )
      .innerJoin("entity_tags as et", (join) =>
        join.onRef("we.entity_tag_id", "=", "et.id")
      )
      .leftJoin("locations as lp", (join) =>
        join.onRef("we.province_id", "=", "lp.id")
      )
      .leftJoin("locations as lr", (join) =>
        join.onRef("we.regency_id", "=", "lr.id")
      )
      .leftJoin("locations as lsd", (join) =>
        join.onRef("we.sub_district_id", "=", "lsd.id")
      )
      .leftJoin("locations as lv", (join) =>
        join.onRef("we.village_id", "=", "lv.id")
      )
      .leftJoin("asset_models as wam", (join) =>
        join.onRef("wai.asset_model_id", "=", "wam.id")
      )
      .leftJoin("asset_types as wat", (join) =>
        join.onRef("wai.asset_type_id", "=", "wat.id")
      )
      .leftJoin("manufactures as wm", (join) =>
        join.onRef("wai.manufacture_id", "=", "wm.id")
      )
      .leftJoin("asset_vendors as wavw", (join) =>
        join.onRef("wai.warranty_asset_vendor_id", "=", "wavw.id")
      )
  }

  async getAssetReachesMaintenance(
    c: CustomContext<DB>,
    limit: number = 100,
    offset: number = 0
  ) {
    const remindDays = [-14, -7, -3, -1, 1, 3, 7, 14]
    return await this.baseQueryAsset(c)
      .select([
        "wai.serial_number as serial_number",
        "wai.ownership_status as ownership_status",
        "wm.name as manufacture_name",
        "wam.name as asset_model_name",
        "wat.name as asset_type_name",
        "we.name as entity_name",
        "lr.name as regency_name",
        "lp.name as province_name",
        "wai.entity_id as entity_id",
        "we.type as entity_type",
        "wai.maintenance_schedule_id as maintenance_schedule_id",
        "wai.maintenance_last_date as last_maintenance_date",
        "wai.calibration_last_date as last_calibration_date",
        "wai.other_asset_model_name as other_asset_model_name",
        "wai.other_asset_manufacture_name as other_asset_manufacture_name",
        "wai.other_asset_type_name as other_asset_type_name",
        sql<Date>`CASE
                WHEN wai.maintenance_schedule_id = 1 THEN DATE_ADD(wai.maintenance_last_date, INTERVAL 1 WEEK)
                WHEN wai.maintenance_schedule_id = 2 THEN DATE_ADD(wai.maintenance_last_date, INTERVAL 1 MONTH)
                WHEN wai.maintenance_schedule_id = 3 THEN DATE_ADD(wai.maintenance_last_date, INTERVAL 6 MONTH)
                WHEN wai.maintenance_schedule_id = 4 THEN DATE_ADD(wai.maintenance_last_date, INTERVAL 12 MONTH)
                WHEN wai.maintenance_schedule_id = 5 THEN DATE_ADD(wai.maintenance_last_date, INTERVAL 18 MONTH)
                WHEN wai.maintenance_schedule_id = 6 THEN DATE_ADD(wai.maintenance_last_date, INTERVAL 24 MONTH)
              END`.as(`next_maintenance_date`),
        sql<number>`DATEDIFF(
              CASE
                WHEN wai.maintenance_schedule_id = 1 THEN DATE_ADD(wai.maintenance_last_date, INTERVAL 1 WEEK)
                WHEN wai.maintenance_schedule_id = 2 THEN DATE_ADD(wai.maintenance_last_date, INTERVAL 1 MONTH)
                WHEN wai.maintenance_schedule_id = 3 THEN DATE_ADD(wai.maintenance_last_date, INTERVAL 6 MONTH)
                WHEN wai.maintenance_schedule_id = 4 THEN DATE_ADD(wai.maintenance_last_date, INTERVAL 12 MONTH)
                WHEN wai.maintenance_schedule_id = 5 THEN DATE_ADD(wai.maintenance_last_date, INTERVAL 18 MONTH)
                WHEN wai.maintenance_schedule_id = 6 THEN DATE_ADD(wai.maintenance_last_date, INTERVAL 24 MONTH)
              END,
              CURRENT_DATE()
        )`.as("days_until_next"),
      ])
      .where("wai.deleted_at", "is", null)
      .where(sql`wai.maintenance_schedule_id`, "is not", null)
      .where(sql`wai.maintenance_last_date`, "is not", null)
      .where(
        sql`DATEDIFF(
          CASE
            WHEN wai.maintenance_schedule_id = 1 THEN DATE_ADD(wai.maintenance_last_date, INTERVAL 1 WEEK)
            WHEN wai.maintenance_schedule_id = 2 THEN DATE_ADD(wai.maintenance_last_date, INTERVAL 1 MONTH)
            WHEN wai.maintenance_schedule_id = 3 THEN DATE_ADD(wai.maintenance_last_date, INTERVAL 6 MONTH)
            WHEN wai.maintenance_schedule_id = 4 THEN DATE_ADD(wai.maintenance_last_date, INTERVAL 12 MONTH)
            WHEN wai.maintenance_schedule_id = 5 THEN DATE_ADD(wai.maintenance_last_date, INTERVAL 18 MONTH)
            WHEN wai.maintenance_schedule_id = 6 THEN DATE_ADD(wai.maintenance_last_date, INTERVAL 24 MONTH)
          END,
          CURRENT_DATE())`,
        "in",
        remindDays
      )
      .limit(limit)
      .offset(offset)
      .execute()
  }

  async getAssetReachesCalibration(
    c: CustomContext<DB>,
    limit: number = 100,
    offset: number = 0
  ) {
    const remindDays = [-14, -7, -3, -1, 1, 3, 7, 14]

    return await this.baseQueryAsset(c)
      .select([
        "wai.serial_number as serial_number",
        "wai.ownership_status as ownership_status",
        "wm.name as manufacture_name",
        "wam.name as asset_model_name",
        "wat.name as asset_type_name",
        "we.name as entity_name",
        "lr.name as regency_name",
        "lp.name as province_name",
        "wai.entity_id as entity_id",
        "we.type as entity_type",
        "wai.calibration_schedule_id as calibration_schedule_id",
        "wai.maintenance_last_date as last_maintenance_date",
        "wai.calibration_last_date as last_calibration_date",
        "wai.other_asset_model_name as other_asset_model_name",
        "wai.other_asset_manufacture_name as other_asset_manufacture_name",
        "wai.other_asset_type_name as other_asset_type_name",
        sql<Date>`CASE
                WHEN wai.calibration_schedule_id = 1 THEN DATE_ADD(wai.calibration_last_date, INTERVAL 1 WEEK)
                WHEN wai.calibration_schedule_id = 2 THEN DATE_ADD(wai.calibration_last_date, INTERVAL 1 MONTH)
                WHEN wai.calibration_schedule_id = 3 THEN DATE_ADD(wai.calibration_last_date, INTERVAL 6 MONTH)
                WHEN wai.calibration_schedule_id = 4 THEN DATE_ADD(wai.calibration_last_date, INTERVAL 12 MONTH)
                WHEN wai.calibration_schedule_id = 5 THEN DATE_ADD(wai.calibration_last_date, INTERVAL 18 MONTH)
                WHEN wai.calibration_schedule_id = 6 THEN DATE_ADD(wai.calibration_last_date, INTERVAL 24 MONTH)
              END`.as(`next_calibration_date`),
        sql<number>`DATEDIFF(
              CASE
                WHEN wai.calibration_schedule_id = 1 THEN DATE_ADD(wai.calibration_last_date, INTERVAL 1 WEEK)
                WHEN wai.calibration_schedule_id = 2 THEN DATE_ADD(wai.calibration_last_date, INTERVAL 1 MONTH)
                WHEN wai.calibration_schedule_id = 3 THEN DATE_ADD(wai.calibration_last_date, INTERVAL 6 MONTH)
                WHEN wai.calibration_schedule_id = 4 THEN DATE_ADD(wai.calibration_last_date, INTERVAL 12 MONTH)
                WHEN wai.calibration_schedule_id = 5 THEN DATE_ADD(wai.calibration_last_date, INTERVAL 18 MONTH)
                WHEN wai.calibration_schedule_id = 6 THEN DATE_ADD(wai.calibration_last_date, INTERVAL 24 MONTH)
              END,
              CURRENT_DATE()
        )`.as("days_until_next"),
      ])
      .where("wai.deleted_at", "is", null)
      .where(sql`wai.calibration_schedule_id`, "is not", null)
      .where(sql`wai.calibration_last_date`, "is not", null)
      .where(
        sql`DATEDIFF(
          CASE
            WHEN wai.calibration_schedule_id = 1 THEN DATE_ADD(wai.calibration_last_date, INTERVAL 1 WEEK)
            WHEN wai.calibration_schedule_id = 2 THEN DATE_ADD(wai.calibration_last_date, INTERVAL 1 MONTH)
            WHEN wai.calibration_schedule_id = 3 THEN DATE_ADD(wai.calibration_last_date, INTERVAL 6 MONTH)
            WHEN wai.calibration_schedule_id = 4 THEN DATE_ADD(wai.calibration_last_date, INTERVAL 12 MONTH)
            WHEN wai.calibration_schedule_id = 5 THEN DATE_ADD(wai.calibration_last_date, INTERVAL 18 MONTH)
            WHEN wai.calibration_schedule_id = 6 THEN DATE_ADD(wai.calibration_last_date, INTERVAL 24 MONTH)
          END,
          CURRENT_DATE())`,
        "in",
        remindDays
      )
      .limit(limit)
      .offset(offset)
      .execute()
  }

  async getAssetWarrantyOverdue(
    c: CustomContext<DB>,
    limit: number = 100,
    offset: number = 0
  ) {
    return await this.baseQueryAsset(c)
      .select([
        "wai.serial_number as serial_number",
        "wai.ownership_status as ownership_status",
        "wm.name as manufacture_name",
        "wam.name as asset_model_name",
        "wat.name as asset_type_name",
        "we.name as entity_name",
        "lr.name as regency_name",
        "lp.name as province_name",
        "wai.entity_id as entity_id",
        "we.type as entity_type",
        "wai.other_asset_model_name as other_asset_model_name",
        "wai.other_asset_manufacture_name as other_asset_manufacture_name",
        "wai.other_asset_type_name as other_asset_type_name",
        "wai.warranty_end_date as warranty_end_date",
      ])
      .where("wai.deleted_at", "is", null)
      .where("wai.warranty_end_date", "is not", null)
      .where(sql`wai.warranty_end_date`, "<", sql`CURRENT_DATE()`)
      .where(sql`DATEDIFF(wai.warranty_end_date, CURRENT_DATE())`, "=", -1)
      .limit(limit)
      .offset(offset)
      .execute()
  }

  async getContactPersonsBySource(
    c: Context,
    sourceId: number,
    sourceType: string
  ) {
    return await c.var.trx
      .selectFrom("contact_persons")
      .select(["name", "phone"])
      .where("source_id", "=", sourceId)
      .where("source_type", "=", sourceType)
      .where("deleted_at", "is", null)
      .execute()
  }

  async deleteContactPersons(c: Context, sourceId: number, sourceType: string) {
    await c.var.trx
      .deleteFrom("contact_persons")
      .where("source_id", "=", sourceId)
      .where("source_type", "=", sourceType)
      .execute()
  }

  async createContactPerson(c: Context, payload: Insertable<ContactPersons>) {
    await c.var.trx.insertInto("contact_persons").values(payload).execute()
  }

  async createAssetInventoryOtherCapacities(
    c: Context,
    payload: {
      asset_inventory_id: number
      gross?: number | null
      net?: number | null
      max_temperature?: number | null
      min_temperature?: number | null
    }
  ) {
    await c.var.trx
      .insertInto("asset_inventory_other_capacities")
      .values({
        asset_inventory_id: payload.asset_inventory_id,
        gross: payload.gross,
        net: payload.net,
        max_temperature: payload.max_temperature,
        min_temperature: payload.min_temperature,
      })
      .execute()
  }

  async getAssetInventoryOtherCapacitiesByInventoryId(
    c: Context,
    assetInventoryId: number
  ) {
    return await c.var.trx
      .selectFrom("asset_inventory_other_capacities")
      .select(["gross", "net", "max_temperature", "min_temperature"])
      .where("asset_inventory_id", "=", assetInventoryId)
      .executeTakeFirst()
  }

  async updateAssetInventoryOtherCapacities(
    c: Context,
    assetInventoryId: number,
    payload: {
      gross?: number | null
      net?: number | null
      max_temperature?: number | null
      min_temperature?: number | null
    }
  ) {
    await c.var.trx
      .updateTable("asset_inventory_other_capacities")
      .set(payload)
      .where("asset_inventory_id", "=", assetInventoryId)
      .execute()
  }

  async deleteAssetInventoryOtherCapacities(
    c: Context,
    assetInventoryId: number
  ) {
    await c.var.trx
      .deleteFrom("asset_inventory_other_capacities")
      .where("asset_inventory_id", "=", assetInventoryId)
      .execute()
  }

  async getAssetInventoryRtmds(c: Context, assetInventoryId: number) {
    // First get the RTMD associations with basic info
    const rtmdAssociations = await c.var.trx
      .selectFrom("asset_inventory_rtmds as air")
      .innerJoin("asset_rtmds as ar", (join) =>
        join.onRef("air.asset_rtmd_id", "=", "ar.id")
      )
      .leftJoin("asset_models as am", (join) =>
        join.onRef("ar.asset_model_id", "=", "am.id")
      )
      .leftJoin("asset_types as at", (join) =>
        join.onRef("ar.asset_type_id", "=", "at.id")
      )
      .leftJoin("manufactures as m", (join) =>
        join.onRef("ar.manufacture_id", "=", "m.id")
      )
      .select([
        "ar.id",
        "air.sensor_qty",
        "air.description",
        "ar.serial_number",
        "am.id as asset_model_id",
        "am.name as asset_model_name",
        "at.id as asset_type_id",
        "at.name as asset_type_name",
        "m.id as manufacture_id",
        "m.name as manufacture_name",
      ])
      .where("air.asset_inventory_id", "=", assetInventoryId)
      .where("ar.deleted_at", "is", null)
      .execute()

    // For each RTMD, get the latest log from asset_rtmd_histories
    const results = await Promise.all(
      rtmdAssociations.map(async (rtmd) => {
        const latestLog = await c.var.trx
          .selectFrom("asset_rtmd_histories")
          .select(["temperature", "updated_at"])
          .where("asset_rtmd_id", "=", rtmd.id)
          .orderBy("updated_at", "desc")
          .limit(1)
          .executeTakeFirst()

        return {
          id: rtmd.id,
          serial_number: rtmd.serial_number,
          sensor_qty: rtmd.sensor_qty,
          description: rtmd.description,
          asset_model: {
            id: rtmd.asset_model_id,
            name: rtmd.asset_model_name,
          },
          asset_type: {
            id: rtmd.asset_type_id,
            name: rtmd.asset_type_name,
          },
          manufacture: {
            id: rtmd.manufacture_id,
            name: rtmd.manufacture_name,
          },
          latest_log: latestLog
            ? {
                temperature: latestLog.temperature,
                updated_at: latestLog.updated_at,
              }
            : null,
        }
      })
    )

    return results
  }

  async getAssetAndRtmdEntityIds(
    c: Context,
    assetId: number,
    rtmdIds: number[]
  ) {
    return await Promise.all([
      c.var.trx
        .selectFrom("asset_inventories")
        .select(["entity_id"])
        .where("id", "=", assetId)
        .where("deleted_at", "is", null)
        .executeTakeFirst(),
      c.var.trx
        .selectFrom("asset_rtmds")
        .select(["entity_id"])
        .where("id", "in", rtmdIds.length > 0 ? rtmdIds : [-1])
        .where("deleted_at", "is", null)
        .execute(),
    ]).then(([asset, rtmds]) => {
      return [asset?.entity_id, collect(rtmds, "entity_id")]
    })
  }

  async syncAssetInventoryRtmds(
    c: Context,
    assetInventoryId: number,
    rtmdAssignments: Array<{
      id: number
      sensor_qty?: number
      description?: string
    }>
  ) {
    const currentDate = new Date()

    // Delete existing RTMD associations for this asset inventory
    await c.var.trx
      .deleteFrom("asset_inventory_rtmds")
      .where("asset_inventory_id", "=", assetInventoryId)
      .execute()

    // Insert new RTMD associations if any provided
    if (rtmdAssignments.length > 0) {
      const values = rtmdAssignments.map((assignment) => ({
        asset_inventory_id: assetInventoryId,
        asset_rtmd_id: assignment.id,
        sensor_qty: assignment.sensor_qty,
        description: assignment.description,
        created_at: currentDate,
        updated_at: currentDate,
      }))

      await c.var.trx
        .insertInto("asset_inventory_rtmds")
        .values(values)
        .execute()
    }
  }

  async deleteAssetInventory(
    c: Context,
    assetInventoryId: number,
    reason: string
  ) {
    const currentDate = new Date()
    const userId = Number(c.var.accountID)

    await c.var.trx
      .updateTable("asset_inventories")
      .set({
        deleted_at: currentDate,
        delete_reason: reason,
        deleted_by: userId,
        updated_at: currentDate,
      })
      .where("id", "=", assetInventoryId)
      .where("deleted_at", "is", null)
      .execute()
  }

  async getModelTemperatureCapacityByAssetTypeAndModelId(
    c: Context,
    assetTypeId: number,
    assetModelId: number
  ) {
    const typeTemperatures = await c.var.trx
      .selectFrom("asset_types as at")
      .innerJoin("asset_types_temperatures as att", (join) =>
        join.onRef("at.id", "=", "att.asset_type_id")
      )
      .innerJoin("asset_types_classifications as atc", (join) =>
        join.onRef("at.id", "=", "atc.asset_type_id")
      )
      .innerJoin("temperature_thresholds as tt", (join) =>
        join.onRef("tt.id", "=", "att.temperature_threshold_id")
      )
      .innerJoin("asset_models_temperatures_capacities as amtc", (join) =>
        join.onRef("att.id", "=", "amtc.asset_type_temperature_id")
      )
      .select(["amtc.id", "tt.min_temperature", "tt.max_temperature"])
      .where("at.id", "=", assetTypeId)
      .where("atc.asset_classifications_id", "=", 1)
      .where("amtc.asset_model_id", "=", assetModelId)
      .where("at.deleted_at", "is", null)
      .orderBy("tt.min_temperature", "desc")
      .execute()

    if (typeTemperatures.length === 0) return null

    if (typeTemperatures.length === 1) return typeTemperatures[0]?.id

    const resultId =
      typeTemperatures.find(
        (t) => t.min_temperature === 2 && t.max_temperature === 8
      )?.id ??
      typeTemperatures[0]?.id ??
      null

    return resultId
  }

  async getWarehouseAssetTypeIds(c: Context) {
    const rows = await c.var.trx
      .selectFrom("asset_types_classifications as atc")
      .select(["atc.asset_type_id"])
      .where(
        "atc.asset_classifications_id",
        "=",
        ASSET_CLASSIFICATION.WAREHOUSE
      )
      .where("atc.deleted_at", "is", null)
      .distinct()
      .execute()

    return collect(rows, "asset_type_id")
  }
}
