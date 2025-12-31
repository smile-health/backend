import { Context } from "hono"
import { GetAssetVendorsQueryParams } from "./asset-vendor.schema.js"
import { sql } from "kysely"

export class AssetVendorRepository {
  async getAssetVendorById(c: Context, id: number, programId: number) {
    return await c.var.trx
      .selectFrom("ws_asset_vendors as wav")
      .innerJoin("users as uc", (join) =>
        join.onRef("wav.created_by", "=", "uc.id")
      )
      .innerJoin("users as uu", (join) =>
        join.onRef("wav.updated_by", "=", "uu.id")
      )
      .select([
        "wav.id",
        "wav.global_id",
        "wav.name",
        "wav.asset_vendor_type_id",
        "wav.asset_vendor_type_name",
        "wav.description",
        "wav.created_at",
        "wav.updated_at",
        "wav.status as status_id",
        "uc.id as user_created_id",
        "uc.username as user_created_username",
        "uc.firstname as user_created_firstname",
        "uc.lastname as user_created_lastname",
        sql<string>`TRIM(CONCAT_WS(' ',COALESCE(CAST(${sql.ref("uc.firstname")} AS CHAR), ''),COALESCE(CAST(${sql.ref("uc.lastname")} AS CHAR), '')))`.as(
          "user_created_fullname"
        ),
        "uu.id as user_updated_id",
        "uu.username as user_updated_username",
        "uu.firstname as user_updated_firstname",
        "uu.lastname as user_updated_lastname",
        sql<string>`TRIM(CONCAT_WS(' ',COALESCE(CAST(${sql.ref("uu.firstname")} AS CHAR), ''),COALESCE(CAST(${sql.ref("uu.lastname")} AS CHAR), '')))`.as(
          "user_updated_fullname"
        ),
      ])
      .where("wav.id", "=", id)
      .where("wav.program_id", "=", programId)
      .executeTakeFirst()
  }

  async getListAssetVendor(
    c: Context,
    programId: number,
    params: GetAssetVendorsQueryParams
  ) {
    const {
      page,
      paginate,
      keyword,
      asset_vendor_type_ids,
      status,
      sort_by,
      sort_type,
    } = params
    const offset = (page - 1) * paginate

    let sortBy
    let sortType

    if (sort_by && sort_type) {
      sortBy = sort_by
      sortType = sort_type
    } else {
      sortBy = "updated_at"
      sortType = "desc"
    }

    let queries = c.var.trx
      .selectFrom("ws_asset_vendors as wav")
      .innerJoin("users as uc", (join) =>
        join.onRef("wav.created_by", "=", "uc.id")
      )
      .innerJoin("users as uu", (join) =>
        join.onRef("wav.updated_by", "=", "uu.id")
      )

    queries = queries.where("wav.program_id", "=", programId)

    if (keyword) {
      queries = queries.where("wav.name", "like", `%${keyword}%`)
    }

    if (asset_vendor_type_ids) {
      queries = queries.where(
        "wav.asset_vendor_type_id",
        "in",
        asset_vendor_type_ids
      )
    }

    if (status === 0 || status === 1) {
      queries = queries.where("wav.status", "=", status)
    }

    const [list, totalList] = await Promise.all([
      queries
        .select([
          "wav.id",
          "wav.global_id",
          "wav.name",
          "wav.description",
          "wav.asset_vendor_type_id",
          "wav.asset_vendor_type_name",
          "wav.status as status_id",
          (eb) =>
            eb
              .case()
              .when(eb.ref("wav.status"), "=", eb.val(1))
              .then(eb.val("active"))
              .else(eb.val("inactive"))
              .end()
              .as("status"),
          "wav.created_at",
          "wav.updated_at",
          "uc.id as user_created_id",
          "uc.username as user_created_username",
          "uc.firstname as user_created_firstname",
          "uc.lastname as user_created_lastname",
          sql<string>`TRIM(CONCAT_WS(' ',COALESCE(CAST(${sql.ref("uc.firstname")} AS CHAR), ''),COALESCE(CAST(${sql.ref("uc.lastname")} AS CHAR), '')))`.as(
            "user_created_fullname"
          ),
          "uu.id as user_updated_id",
          "uu.username as user_updated_username",
          "uu.firstname as user_updated_firstname",
          "uu.lastname as user_updated_lastname",
          sql<string>`TRIM(CONCAT_WS(' ',COALESCE(CAST(${sql.ref("uu.firstname")} AS CHAR), ''),COALESCE(CAST(${sql.ref("uu.lastname")} AS CHAR), '')))`.as(
            "user_updated_fullname"
          ),
        ])
        .orderBy(sortBy, sortType)
        .limit(paginate)
        .offset(offset)
        .execute(),
      queries.select((eb) => eb.fn.countAll().as("total")).executeTakeFirst(),
    ])

    return {
      list: list,
      total: Number(totalList?.total) || 0,
    }
  }

  async updateAssetVendorWorkspaceById(
    c: Context,
    id: number,
    programId: number,
    data
  ) {
    await c.var.trx
      .updateTable("asset_vendor_workspaces")
      .set(data)
      .where("id", "=", id)
      .where("workspace_id", "=", programId)
      .executeTakeFirst()
  }

  async getListAssetVendorWithoutPaginate(
    c: Context,
    programId: number,
    params: GetAssetVendorsQueryParams
  ) {
    const { keyword, asset_vendor_type_ids, status, sort_by, sort_type } =
      params

    let sortBy
    let sortType

    if (sort_by && sort_type) {
      sortBy = sort_by
      sortType = sort_type
    } else {
      sortBy = "updated_at"
      sortType = "desc"
    }

    let queries = c.var.trx
      .selectFrom("ws_asset_vendors as wav")
      .innerJoin("users as uc", (join) =>
        join.onRef("wav.created_by", "=", "uc.id")
      )
      .innerJoin("users as uu", (join) =>
        join.onRef("wav.updated_by", "=", "uu.id")
      )

    queries = queries.where("wav.program_id", "=", programId)

    if (keyword) {
      queries = queries.where("wav.name", "like", `%${keyword}%`)
    }

    if (asset_vendor_type_ids) {
      queries = queries.where(
        "wav.asset_vendor_type_id",
        "in",
        asset_vendor_type_ids
      )
    }

    if (status === 0 || status === 1) {
      queries = queries.where("wav.status", "=", status)
    }

    const list = await queries
      .select([
        "wav.id",
        "wav.global_id",
        "wav.name",
        "wav.description",
        "wav.asset_vendor_type_id",
        "wav.asset_vendor_type_name",
        "wav.status as status_id",
        (eb) =>
          eb
            .case()
            .when(eb.ref("wav.status"), "=", eb.val(1))
            .then(eb.val("active"))
            .else(eb.val("inactive"))
            .end()
            .as("status"),
        "wav.created_at",
        "wav.updated_at",
        "uc.id as user_created_id",
        "uc.username as user_created_username",
        "uc.firstname as user_created_firstname",
        "uc.lastname as user_created_lastname",
        sql<string>`TRIM(CONCAT_WS(' ',COALESCE(CAST(${sql.ref("uc.firstname")} AS CHAR), ''),COALESCE(CAST(${sql.ref("uc.lastname")} AS CHAR), '')))`.as(
          "user_created_fullname"
        ),
        "uu.id as user_updated_id",
        "uu.username as user_updated_username",
        "uu.firstname as user_updated_firstname",
        "uu.lastname as user_updated_lastname",
        sql<string>`TRIM(CONCAT_WS(' ',COALESCE(CAST(${sql.ref("uu.firstname")} AS CHAR), ''),COALESCE(CAST(${sql.ref("uu.lastname")} AS CHAR), '')))`.as(
          "user_updated_fullname"
        ),
      ])
      .orderBy(sortBy, sortType)
      .execute()

    return list
  }

  async getOnlyAssetVendorById(c: Context, id: number, programId: number) {
    return await c.var.trx
      .selectFrom("ws_asset_vendors")
      .selectAll()
      .where("id", "=", id)
      .where("program_id", "=", programId)
      .executeTakeFirst()
  }

  async getAssetInventoriesByWarrantyVendorId(
    c: Context,
    warrantyVendorId: number,
    programId: number
  ) {
    return await c.var.trx
      .selectFrom("ws_asset_inventories")
      .select(["id", "warranty_asset_vendor_id"])
      .where("warranty_asset_vendor_id", "=", warrantyVendorId)
      .where("program_id", "=", programId)
      .executeTakeFirst()
  }

  async getAssetInventoriesByCalibrationVendorId(
    c: Context,
    calibrationVendorId: number,
    programId: number
  ) {
    return await c.var.trx
      .selectFrom("ws_asset_inventories")
      .select(["id", "calibration_asset_vendor_id"])
      .where("calibration_asset_vendor_id", "=", calibrationVendorId)
      .where("program_id", "=", programId)
      .executeTakeFirst()
  }

  async getAssetInventoriesByMaintenanceVendorId(
    c: Context,
    maintenanceVendorId: number,
    programId: number
  ) {
    return await c.var.trx
      .selectFrom("ws_asset_inventories")
      .select(["id", "maintenance_asset_vendor_id"])
      .where("maintenance_asset_vendor_id", "=", maintenanceVendorId)
      .where("program_id", "=", programId)
      .executeTakeFirst()
  }
}
