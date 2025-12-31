import { Context } from "hono"
import { GetAssetModelsQueryParams } from "./asset-model.schema.js"
import { sql } from "kysely"

export class AssetModelRepository {
  async getAssetModelById(c: Context, id: number, programId: number) {
    return await c.var.trx
      .selectFrom("ws_asset_models as wam")
      .innerJoin("users as uc", (join) =>
        join.onRef("wam.created_by", "=", "uc.id")
      )
      .innerJoin("users as uu", (join) =>
        join.onRef("wam.updated_by", "=", "uu.id")
      )
      .select([
        "wam.id",
        "wam.global_id",
        "wam.name",
        "wam.asset_type_id",
        "wam.asset_type_name",
        "wam.manufacture_id",
        "wam.manufacture_name",
        "wam.net_capacity",
        "wam.gross_capacity",
        "wam.created_at",
        "wam.updated_at",
        "wam.status as status_id",
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
      .where("wam.id", "=", id)
      .where("wam.program_id", "=", programId)
      .executeTakeFirst()
  }

  async getListAssetModel(
    c: Context,
    programId: number,
    params: GetAssetModelsQueryParams
  ) {
    const {
      page,
      paginate,
      keyword,
      asset_type_ids,
      manufacture_ids,
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
      .selectFrom("ws_asset_models as wam")
      .innerJoin("users as uc", (join) =>
        join.onRef("wam.created_by", "=", "uc.id")
      )
      .innerJoin("users as uu", (join) =>
        join.onRef("wam.updated_by", "=", "uu.id")
      )

    queries = queries.where("wam.program_id", "=", programId)

    if (keyword) {
      queries = queries.where("wam.name", "like", `%${keyword}%`)
    }

    if (asset_type_ids) {
      queries = queries.where("wam.asset_type_id", "in", asset_type_ids)
    }

    if (manufacture_ids) {
      queries = queries.where("wam.manufacture_id", "in", manufacture_ids)
    }

    if (status === 0 || status === 1) {
      console.log(status)
      queries = queries.where("wam.status", "=", status)
    }

    const [list, totalList] = await Promise.all([
      queries
        .select([
          "wam.id",
          "wam.global_id",
          "wam.name",
          "wam.asset_type_id",
          "wam.asset_type_name",
          "wam.manufacture_id",
          "wam.manufacture_name",
          "wam.net_capacity",
          "wam.gross_capacity",
          "wam.created_at",
          "wam.updated_at",
          "wam.status as status_id",
          (eb) =>
            eb
              .case()
              .when(eb.ref("wam.status"), "=", eb.val(1))
              .then(eb.val("active"))
              .else(eb.val("inactive"))
              .end()
              .as("status"),
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

  async updateAssetModelWorkspaceById(
    c: Context,
    id: number,
    programId: number,
    data
  ) {
    await c.var.trx
      .updateTable("asset_model_workspaces")
      .set(data)
      .where("id", "=", id)
      .where("workspace_id", "=", programId)
      .executeTakeFirst()
  }

  async getListAssetModelWithoutPaginate(
    c: Context,
    programId: number,
    params: GetAssetModelsQueryParams
  ) {
    const {
      keyword,
      asset_type_ids,
      manufacture_ids,
      status,
      sort_by,
      sort_type,
    } = params

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
      .selectFrom("ws_asset_models as wam")
      .innerJoin("users as uc", (join) =>
        join.onRef("wam.created_by", "=", "uc.id")
      )
      .innerJoin("users as uu", (join) =>
        join.onRef("wam.updated_by", "=", "uu.id")
      )

    queries = queries.where("wam.program_id", "=", programId)

    if (keyword) {
      queries = queries.where("wam.name", "like", `%${keyword}%`)
    }

    if (asset_type_ids) {
      queries = queries.where("wam.asset_type_id", "in", asset_type_ids)
    }

    if (manufacture_ids) {
      queries = queries.where("wam.manufacture_id", "in", manufacture_ids)
    }

    if (status === 0 || status === 1) {
      console.log(status)
      queries = queries.where("wam.status", "=", status)
    }

    const list = await queries
      .select([
        "wam.id",
        "wam.global_id",
        "wam.name",
        "wam.asset_type_id",
        "wam.asset_type_name",
        "wam.manufacture_id",
        "wam.manufacture_name",
        "wam.net_capacity",
        "wam.gross_capacity",
        "wam.created_at",
        "wam.updated_at",
        "wam.status as status_id",
        (eb) =>
          eb
            .case()
            .when(eb.ref("wam.status"), "=", eb.val(1))
            .then(eb.val("active"))
            .else(eb.val("inactive"))
            .end()
            .as("status"),
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

  async getOnlyAssetModelById(c: Context, id: number, programId: number) {
    return await c.var.trx
      .selectFrom("ws_asset_models")
      .selectAll()
      .where("id", "=", id)
      .where("program_id", "=", programId)
      .executeTakeFirst()
  }

  async getAssetInventoriesByAssetModelId(
    c: Context,
    assetModelId: number,
    programId: number
  ) {
    return await c.var.trx
      .selectFrom("ws_asset_inventories")
      .select(["id", "asset_model_id"])
      .where("asset_model_id", "=", assetModelId)
      .where("program_id", "=", programId)
      .executeTakeFirst()
  }
}
