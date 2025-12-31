import { Context } from "hono"
import { GetAssetTypesQueryParams } from "./asset-type.schema.js"
import { sql } from "kysely"

export class AssetTypeRepository {
  async getAssetTypeById(c: Context, id: number, programId: number) {
    return await c.var.trx
      .selectFrom("ws_asset_types as wat")
      .innerJoin("users as uc", (join) =>
        join.onRef("wat.created_by", "=", "uc.id")
      )
      .innerJoin("users as uu", (join) =>
        join.onRef("wat.updated_by", "=", "uu.id")
      )
      .select([
        "wat.id",
        "wat.global_id",
        "wat.name",
        "wat.min_temperature",
        "wat.max_temperature",
        "wat.description",
        "wat.created_at",
        "wat.updated_at",
        "wat.status as status_id",
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
      .where("wat.id", "=", id)
      .where("wat.program_id", "=", programId)
      .executeTakeFirst()
  }

  async getListAssetType(
    c: Context,
    programId: number,
    params: GetAssetTypesQueryParams
  ) {
    const { page, paginate, keyword, status, sort_by, sort_type } = params
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
      .selectFrom("ws_asset_types as wat")
      .innerJoin("users as uc", (join) =>
        join.onRef("wat.created_by", "=", "uc.id")
      )
      .innerJoin("users as uu", (join) =>
        join.onRef("wat.updated_by", "=", "uu.id")
      )

    queries = queries.where("wat.program_id", "=", programId)

    if (keyword) {
      queries = queries.where("wat.name", "like", `%${keyword}%`)
    }

    if (status === 0 || status === 1) {
      queries = queries.where("wat.status", "=", status)
    }

    const [list, totalList] = await Promise.all([
      queries
        .select([
          "wat.id",
          "wat.global_id",
          "wat.name",
          "wat.description",
          "wat.min_temperature",
          "wat.max_temperature",
          "wat.status as status_id",
          (eb) =>
            eb
              .case()
              .when(eb.ref("wat.status"), "=", eb.val(1))
              .then(eb.val("active"))
              .else(eb.val("inactive"))
              .end()
              .as("status"),
          "wat.created_at",
          "wat.updated_at",
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

  async updateAssetTypeWorkspaceById(
    c: Context,
    id: number,
    programId: number,
    data
  ) {
    await c.var.trx
      .updateTable("asset_type_workspaces")
      .set(data)
      .where("id", "=", id)
      .where("workspace_id", "=", programId)
      .executeTakeFirst()
  }

  async getListAssetTypeWithoutPaginate(
    c: Context,
    programId: number,
    params: GetAssetTypesQueryParams
  ) {
    const { keyword, status, sort_by, sort_type } = params

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
      .selectFrom("ws_asset_types as wat")
      .innerJoin("users as uc", (join) =>
        join.onRef("wat.created_by", "=", "uc.id")
      )
      .innerJoin("users as uu", (join) =>
        join.onRef("wat.updated_by", "=", "uu.id")
      )

    queries = queries.where("wat.program_id", "=", programId)

    if (keyword) {
      queries = queries.where("wat.name", "like", `%${keyword}%`)
    }

    if (status === 0 || status === 1) {
      queries = queries.where("wat.status", "=", status)
    }

    const list = await queries
      .select([
        "wat.id",
        "wat.global_id",
        "wat.name",
        "wat.description",
        "wat.min_temperature",
        "wat.max_temperature",
        "wat.status as status_id",
        (eb) =>
          eb
            .case()
            .when(eb.ref("wat.status"), "=", eb.val(1))
            .then(eb.val("active"))
            .else(eb.val("inactive"))
            .end()
            .as("status"),
        "wat.created_at",
        "wat.updated_at",
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

  async getOnlyAssetTypeById(c: Context, id: number, programId: number) {
    return await c.var.trx
      .selectFrom("ws_asset_types")
      .selectAll()
      .where("id", "=", id)
      .where("program_id", "=", programId)
      .executeTakeFirst()
  }

  async getAssetInventoriesByAssetTypeId(
    c: Context,
    assetTypeId: number,
    programId: number
  ) {
    return await c.var.trx
      .selectFrom("ws_asset_inventories")
      .select(["id", "asset_type_id"])
      .where("asset_type_id", "=", assetTypeId)
      .where("program_id", "=", programId)
      .executeTakeFirst()
  }
}
