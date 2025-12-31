import { Context } from "hono"
import { sql } from "kysely"
import { BaseRepository } from "../base.repository.js"
import { GetAssetInventorysQueryParams } from "./asset-inventory.schema.js"
import { DB } from "@/common/infrastructure/database/types/db.js"
import { CustomContext } from "@smile/lib/types/context.js"

export class AssetInventoryRepository extends BaseRepository<"ws_asset_inventories"> {
  constructor() {
    super("ws_asset_inventories")
  }

  async getAssetInventoryById(c: Context, id: number, programId: number) {
    return await c.var.trx
      .selectFrom("ws_asset_inventories as wai")
      .innerJoin("ws_entities as we", (join) =>
        join
          .onRef("wai.entity_id", "=", "we.id")
          .on("we.program_id", "=", programId)
      )
      .innerJoin("entity_tags as et", (join) =>
        join.onRef("we.entity_tag_id", "=", "et.id")
      )
      .innerJoin("ws_users as wuc", (join) =>
        join
          .onRef("wai.created_by", "=", "wuc.id")
          .on("wuc.program_id", "=", programId)
      )
      .innerJoin("ws_users as wuu", (join) =>
        join
          .onRef("wai.updated_by", "=", "wuu.id")
          .on("wuu.program_id", "=", programId)
      )
      .innerJoin("workspaces as w", (join) =>
        join.onRef("wai.program_id", "=", "w.id")
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
      .leftJoin("ws_asset_models as wam", (join) =>
        join
          .onRef("wai.asset_model_id", "=", "wam.id")
          .on("wam.program_id", "=", programId)
      )
      .leftJoin("ws_asset_types as wat", (join) =>
        join
          .onRef("wai.asset_type_id", "=", "wat.id")
          .on("wat.program_id", "=", programId)
      )
      .leftJoin("ws_manufactures as wm", (join) =>
        join
          .onRef("wai.manufacture_id", "=", "wm.id")
          .on("wm.program_id", "=", programId)
      )
      .leftJoin("ws_asset_working_statuses as waws", (join) =>
        join.onRef("wai.asset_working_status_id", "=", "waws.id")
      )
      .leftJoin("ws_budget_sources as wbs", (join) =>
        join
          .onRef("wai.budget_source_id", "=", "wbs.id")
          .on("wbs.program_id", "=", programId)
      )
      .leftJoin("ws_entities as web", (join) =>
        join
          .onRef("wai.borrowed_from_entity_id", "=", "web.id")
          .on("web.program_id", "=", programId)
      )
      .leftJoin("ws_asset_vendors as wavw", (join) =>
        join
          .onRef("wai.warranty_asset_vendor_id", "=", "wavw.id")
          .on("wavw.program_id", "=", programId)
      )
      .leftJoin("ws_asset_calibration_schedules as wacs", (join) =>
        join.onRef("wai.calibration_schedule_id", "=", "wacs.id")
      )
      .leftJoin("ws_asset_vendors as wavc", (join) =>
        join
          .onRef("wai.calibration_asset_vendor_id", "=", "wavc.id")
          .on("wavc.program_id", "=", programId)
      )
      .leftJoin("ws_asset_maintenance_schedules as wams", (join) =>
        join.onRef("wai.maintenance_schedule_id", "=", "wams.id")
      )
      .leftJoin("ws_asset_vendors as wavm", (join) =>
        join
          .onRef("wai.maintenance_asset_vendor_id", "=", "wavm.id")
          .on("wavm.program_id", "=", programId)
      )
      .leftJoin("ws_asset_electricities as wac", (join) =>
        join.onRef("wai.asset_electricity_id", "=", "wac.id")
      )
      .select([
        "wai.id",
        "wai.asset_electricity_id",
        "wac.name as asset_electricity_name",
        "wai.asset_model_id",
        "wam.name as asset_model_name",
        "wai.asset_type_id",
        "wat.name as asset_type_name",
        "wai.asset_working_status_id",
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
        "wai.contact_person_user_1_name",
        "wai.contact_person_user_1_number",
        "wai.contact_person_user_2_name",
        "wai.contact_person_user_2_number",
        "wai.contact_person_user_3_name",
        "wai.contact_person_user_3_number",
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
        "wam.gross_capacity",
        "wai.maintenance_asset_vendor_id",
        "wavm.name as maintenance_asset_vendor_name",
        "wai.maintenance_last_date",
        "wai.maintenance_schedule_id",
        "wams.name as maintenance_schedule_name",
        "wai.manufacture_id",
        "wm.name as manufacture_name",
        "wat.max_temperature",
        "wat.min_temperature",
        "wam.net_capacity",
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
        "wai.other_net_capacity",
        "wai.other_gross_capacity",
        "wai.other_asset_type_name",
        "wai.other_min_temperature",
        "wai.other_max_temperature",
        "wai.other_manufacture_name",
        "wai.other_budget_source_name",
        "wai.other_borrowed_from_entity_name",
        "w.id as program_id",
        "w.key as program_key",
        "w.name as program_name",
        "w.config as program_config",
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
      ])
      .where("wai.id", "=", id)
      .where("wai.program_id", "=", programId)
      .where("wai.deleted_at", "is", null)
      .executeTakeFirst()
  }

  async getListAssetInventory(
    c: Context,
    programId: number,
    params: GetAssetInventorysQueryParams,
    entityId: number | number[]
  ) {
    const {
      page,
      paginate,
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
      sort_by,
      sort_type,
    } = params
    const offset = (page - 1) * paginate

    let sort

    if (sort_by && sort_type) {
      if (sort_by === "name") {
        sort = [
          ["asset_model_name", sort_type],
          ["other_asset_model_name", sort_type],
          ["manufacture_name", sort_type],
          ["other_manufacture_name", sort_type],
          ["serial_number", sort_type],
        ]
      } else {
        sort = [[sort_by, sort_type]]
      }
    } else {
      sort = [["updated_at", "desc"]]
    }

    let queries = c.var.trx
      .selectFrom("ws_asset_inventories as wai")
      .innerJoin("ws_entities as we", (join) =>
        join
          .onRef("wai.entity_id", "=", "we.id")
          .on("we.program_id", "=", programId)
      )
      .innerJoin("ws_users as wuu", (join) =>
        join
          .onRef("wai.updated_by", "=", "wuu.id")
          .on("wuu.program_id", "=", programId)
      )
      .leftJoin("locations as lp", (join) =>
        join.onRef("we.province_id", "=", "lp.id")
      )
      .leftJoin("locations as lr", (join) =>
        join.onRef("we.regency_id", "=", "lr.id")
      )
      .leftJoin("ws_asset_models as wam", (join) =>
        join
          .onRef("wai.asset_model_id", "=", "wam.id")
          .on("wam.program_id", "=", programId)
      )
      .leftJoin("ws_asset_types as wat", (join) =>
        join
          .onRef("wai.asset_type_id", "=", "wat.id")
          .on("wat.program_id", "=", programId)
      )
      .leftJoin("ws_manufactures as wm", (join) =>
        join
          .onRef("wai.manufacture_id", "=", "wm.id")
          .on("wm.program_id", "=", programId)
      )
      .leftJoin("ws_asset_working_statuses as waws", (join) =>
        join.onRef("wai.asset_working_status_id", "=", "waws.id")
      )

    queries = queries.where("wai.program_id", "=", programId)
    queries = queries.where("wai.deleted_at", "is", null)

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
          eb("wai.other_manufacture_name", "like", `%${keyword}%`),
          eb("wai.serial_number", "like", `%${keyword}%`),
        ])
      )
    }

    if (asset_type_ids) {
      queries = queries.where("wai.asset_type_id", "in", asset_type_ids)
    }

    if (manufacture_ids) {
      queries = queries.where("wai.manufacture_id", "in", manufacture_ids)
    }

    if (working_status_id) {
      queries = queries.where(
        "wai.asset_working_status_id",
        "=",
        working_status_id
      )
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

    const baseQuery = queries.select([
      "wai.id",
      "wai.asset_model_id",
      "wam.name as asset_model_name",
      "wai.asset_type_id",
      "wat.name as asset_type_name",
      "wai.asset_working_status_id",
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
      "wai.other_manufacture_name",
    ])

    const orderedQuery = sort.reduce(
      (q, [col, dir]) => q.orderBy(col as any, dir),
      baseQuery
    )

    const [list, totalList] = await Promise.all([
      orderedQuery.limit(paginate).offset(offset).execute(),
      queries.select((eb) => eb.fn.countAll().as("total")).executeTakeFirst(),
    ])

    return {
      list: list,
      total: Number(totalList?.total) || 0,
    }
  }

  async getListAssetInventoryWithoutPaginate(
    c: Context,
    programId: number,
    params: GetAssetInventorysQueryParams,
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
      sort_by,
      sort_type,
    } = params

    let sort

    if (sort_by && sort_type) {
      if (sort_by === "name") {
        sort = [
          ["asset_model_name", sort_type],
          ["other_asset_model_name", sort_type],
          ["manufacture_name", sort_type],
          ["other_manufacture_name", sort_type],
          ["serial_number", sort_type],
        ]
      } else {
        sort = [[sort_by, sort_type]]
      }
    } else {
      sort = [["updated_at", "desc"]]
    }

    let queries = c.var.trx
      .selectFrom("ws_asset_inventories as wai")
      .innerJoin("ws_entities as we", (join) =>
        join
          .onRef("wai.entity_id", "=", "we.id")
          .on("we.program_id", "=", programId)
      )
      .innerJoin("ws_users as wuu", (join) =>
        join
          .onRef("wai.updated_by", "=", "wuu.id")
          .on("wuu.program_id", "=", programId)
      )
      .leftJoin("locations as lp", (join) =>
        join.onRef("we.province_id", "=", "lp.id")
      )
      .leftJoin("locations as lr", (join) =>
        join.onRef("we.regency_id", "=", "lr.id")
      )
      .leftJoin("ws_asset_models as wam", (join) =>
        join
          .onRef("wai.asset_model_id", "=", "wam.id")
          .on("wam.program_id", "=", programId)
      )
      .leftJoin("ws_asset_types as wat", (join) =>
        join
          .onRef("wai.asset_type_id", "=", "wat.id")
          .on("wat.program_id", "=", programId)
      )
      .leftJoin("ws_manufactures as wm", (join) =>
        join
          .onRef("wai.manufacture_id", "=", "wm.id")
          .on("wm.program_id", "=", programId)
      )
      .leftJoin("ws_asset_working_statuses as waws", (join) =>
        join.onRef("wai.asset_working_status_id", "=", "waws.id")
      )

    queries = queries.where("wai.program_id", "=", programId)
    queries = queries.where("wai.deleted_at", "is", null)

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
          eb("wai.other_manufacture_name", "like", `%${keyword}%`),
          eb("wai.serial_number", "like", `%${keyword}%`),
        ])
      )
    }

    if (asset_type_ids) {
      queries = queries.where("wai.asset_type_id", "in", asset_type_ids)
    }

    if (manufacture_ids) {
      queries = queries.where("wai.manufacture_id", "in", manufacture_ids)
    }

    if (working_status_id) {
      queries = queries.where(
        "wai.asset_working_status_id",
        "=",
        working_status_id
      )
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

    const baseQuery = queries.select([
      "wai.id",
      "wai.asset_model_id",
      "wam.name as asset_model_name",
      "wai.asset_type_id",
      "wat.name as asset_type_name",
      "wai.asset_working_status_id",
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
      "wai.other_manufacture_name",
    ])

    const orderedQuery = sort.reduce(
      (q, [col, dir]) => q.orderBy(col as any, dir),
      baseQuery
    )

    const list = await orderedQuery.execute()

    return list
  }

  async getOnlyAssetInventoryById(c: Context, id: number, programId: number) {
    return await c.var.trx
      .selectFrom("ws_asset_inventories")
      .selectAll()
      .where("id", "=", id)
      .where("program_id", "=", programId)
      .where("deleted_at", "is", null)
      .executeTakeFirst()
  }

  async getOnlyAssetInventoryBySerialNumber(
    c: Context,
    serialNumber: string,
    programId: number
  ) {
    return await c.var.trx
      .selectFrom("ws_asset_inventories")
      .select(["id"])
      .where("serial_number", "=", serialNumber)
      .where("program_id", "=", programId)
      .where("deleted_at", "is", null)
      .executeTakeFirst()
  }

  async getAssetElectricityById(c: Context, id: number) {
    return await c.var.trx
      .selectFrom("ws_asset_electricities")
      .select(["id"])
      .where("id", "=", id)
      .where("deleted_at", "is", null)
      .executeTakeFirst()
  }

  async getAssetModelById(c: Context, id: number, programId: number) {
    return await c.var.trx
      .selectFrom("ws_asset_models")
      .select(["id"])
      .where("id", "=", id)
      .where("program_id", "=", programId)
      .where("status", "=", 1)
      .executeTakeFirst()
  }

  async getAssetTypeById(c: Context, id: number, programId: number) {
    return await c.var.trx
      .selectFrom("ws_asset_types")
      .select(["id"])
      .where("id", "=", id)
      .where("program_id", "=", programId)
      .where("status", "=", 1)
      .executeTakeFirst()
  }

  async getAssetWorkingStatusById(c: Context, id: number) {
    return await c.var.trx
      .selectFrom("ws_asset_working_statuses")
      .select(["id"])
      .where("id", "=", id)
      .where("deleted_at", "is", null)
      .executeTakeFirst()
  }

  async getBudgetSourceById(c: Context, id: number, programId: number) {
    return await c.var.trx
      .selectFrom("ws_budget_sources")
      .select(["id"])
      .where("id", "=", id)
      .where("program_id", "=", programId)
      .where("status", "=", 1)
      .executeTakeFirst()
  }

  async getAssetVendorByCalibrationVendorId(
    c: Context,
    calibrationVendorId: number,
    programId: number
  ) {
    return await c.var.trx
      .selectFrom("ws_asset_vendors")
      .select(["id"])
      .where("id", "=", calibrationVendorId)
      .where("program_id", "=", programId)
      .where("status", "=", 1)
      .executeTakeFirst()
  }

  async getAssetCalibrationScheduleById(c: Context, id: number) {
    return await c.var.trx
      .selectFrom("ws_asset_calibration_schedules")
      .select(["id"])
      .where("id", "=", id)
      .where("deleted_at", "is", null)
      .executeTakeFirst()
  }

  async getAssetVendorByMaintenanceVendorId(
    c: Context,
    maintenanceVendorId: number,
    programId: number
  ) {
    return await c.var.trx
      .selectFrom("ws_asset_vendors")
      .select(["id"])
      .where("id", "=", maintenanceVendorId)
      .where("program_id", "=", programId)
      .where("status", "=", 1)
      .executeTakeFirst()
  }

  async getAssetMaintenanceScheduleById(c: Context, id: number) {
    return await c.var.trx
      .selectFrom("ws_asset_maintenance_schedules")
      .select(["id"])
      .where("id", "=", id)
      .where("deleted_at", "is", null)
      .executeTakeFirst()
  }

  async getManufactureById(c: Context, id: number, programId: number) {
    return await c.var.trx
      .selectFrom("ws_manufactures")
      .select(["id"])
      .where("id", "=", id)
      .where("program_id", "=", programId)
      .where("status", "=", 1)
      .executeTakeFirst()
  }

  async getAssetVendorByWarrantyVendorId(
    c: Context,
    warrantyVendorId: number,
    programId: number
  ) {
    return await c.var.trx
      .selectFrom("ws_asset_vendors")
      .select(["id"])
      .where("id", "=", warrantyVendorId)
      .where("program_id", "=", programId)
      .where("status", "=", 1)
      .executeTakeFirst()
  }

  async getEntityById(c: Context, id: number, programId: number) {
    return await c.var.trx
      .selectFrom("ws_entities")
      .select([
        "id",
        "province_id",
        "regency_id",
        "sub_district_id",
        "type",
        "is_puskesmas",
      ])
      .where("id", "=", id)
      .where("program_id", "=", programId)
      .where("status", "=", 1)
      .executeTakeFirst()
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

  async getPermittedLendingEntitiesByProvinces(
    c: Context,
    programId: number,
    provinceIds
  ) {
    return await c.var.trx
      .selectFrom("ws_entities")
      .select(["id"])
      .where("program_id", "=", programId)
      .where("province_id", "in", provinceIds)
      .where("regency_id", "is", null)
      .where("sub_district_id", "is", null)
      .where("type", "=", 1)
      .where("deleted_at", "is", null)
      .execute()
  }

  async getPermittedLendingEntitiesByRegencies(
    c: Context,
    programId: number,
    provinceId,
    regencyIds
  ) {
    return await c.var.trx
      .selectFrom("ws_entities")
      .select(["id"])
      .where("program_id", "=", programId)
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
    programId: number,
    provinceId,
    regencyId,
    subDistrictIds
  ) {
    return await c.var.trx
      .selectFrom("ws_entities")
      .select(["id"])
      .where("program_id", "=", programId)
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

  async getEntityByProvince(c: Context, programId: number, provinceId: string) {
    return await c.var.trx
      .selectFrom("ws_entities")
      .select(["id"])
      .where((eb) =>
        eb.or([
          eb.and([
            eb("program_id", "=", programId),
            eb("province_id", "=", provinceId),
            eb("regency_id", "is", null),
            eb("sub_district_id", "is", null),
            eb("village_id", "is", null),
            eb("type", "=", 1),
            eb("is_puskesmas", "=", 0),
          ]),
          eb.and([
            eb("program_id", "=", programId),
            eb("province_id", "=", provinceId),
            eb("sub_district_id", "is", null),
            eb("village_id", "is", null),
            eb("type", "=", 2),
            eb("is_puskesmas", "=", 0),
          ]),
          eb.and([
            eb("program_id", "=", programId),
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

  async getEntityByRegency(c: Context, programId: number, regencyId: string) {
    return await c.var.trx
      .selectFrom("ws_entities")
      .select(["id"])
      .where((eb) =>
        eb.or([
          eb.and([
            eb("program_id", "=", programId),
            eb("regency_id", "=", regencyId),
            eb("sub_district_id", "is", null),
            eb("village_id", "is", null),
            eb("type", "=", 2),
            eb("is_puskesmas", "=", 0),
          ]),
          eb.and([
            eb("program_id", "=", programId),
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
      .selectFrom("ws_asset_inventories as wai")
      .innerJoin("ws_entities as we", (join) =>
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
      .leftJoin("ws_asset_models as wam", (join) =>
        join.onRef("wai.asset_model_id", "=", "wam.id")
      )
      .leftJoin("ws_asset_types as wat", (join) =>
        join.onRef("wai.asset_type_id", "=", "wat.id")
      )
      .leftJoin("ws_manufactures as wm", (join) =>
        join.onRef("wai.manufacture_id", "=", "wm.id")
      )
      .leftJoin("ws_asset_vendors as wavw", (join) =>
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
        "wai.other_manufacture_name as other_manufacture_name",
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
        "wai.other_manufacture_name as other_manufacture_name",
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
        "wai.other_manufacture_name as other_manufacture_name",
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
}
