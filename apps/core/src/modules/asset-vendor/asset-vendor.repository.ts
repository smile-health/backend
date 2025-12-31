import { ASSET_MONITORING_DEVICE } from "@/common/constants/assets.js"
import { Context } from "hono"
import { sql } from "kysely"
import { Readable } from "stream"
import { BaseRepository } from "../base.repository.js"
import { GetAssetVendorsQueryParams } from "./asset-vendor.schema.js"

function readableToAsyncIterable<T>(
  readable: Readable
): AsyncIterableIterator<T> {
  const iterator = (async function* () {
    for await (const chunk of readable) {
      yield chunk as T
    }
  })()
  return iterator
}

export class AssetVendorRepository extends BaseRepository<"asset_vendors"> {
  constructor() {
    super("asset_vendors")
  }

  async getAssetVendorById(c: Context, id: number) {
    return await c.var.trx
      .selectFrom("asset_vendors as av")
      .innerJoin("asset_vendor_types as avt", (join) =>
        join.onRef("av.asset_vendor_type_id", "=", "avt.id")
      )
      .innerJoin("users as uc", (join) =>
        join.onRef("av.created_by", "=", "uc.id")
      )
      .innerJoin("users as uu", (join) =>
        join.onRef("av.updated_by", "=", "uu.id")
      )
      .select([
        "av.id",
        "av.name",
        "av.asset_vendor_type_id",
        "avt.name as asset_vendor_type_name",
        "av.description",
        "av.created_at",
        "av.updated_at",
        "uc.id as user_created_id",
        "uc.username as user_created_username",
        "uc.firstname as user_created_firstname",
        "uc.lastname as user_created_lastname",
        sql<string>`TRIM(CONCAT(COALESCE(CAST(${sql.ref("uc.firstname")} AS CHAR), ''),COALESCE(CAST(${sql.ref("uc.lastname")} AS CHAR), '')))`.as(
          "user_created_fullname"
        ),
        "uu.id as user_updated_id",
        "uu.username as user_updated_username",
        "uu.firstname as user_updated_firstname",
        "uu.lastname as user_updated_lastname",
        sql<string>`TRIM(CONCAT(COALESCE(CAST(${sql.ref("uu.firstname")} AS CHAR), ''),COALESCE(CAST(${sql.ref("uu.lastname")} AS CHAR), '')))`.as(
          "user_updated_fullname"
        ),
      ])
      .where("av.id", "=", id)
      .where("av.deleted_at", "is", null)
      .execute()
  }

  async getListAssetVendor(c: Context, params: GetAssetVendorsQueryParams) {
    const {
      page,
      paginate,
      keyword,
      asset_vendor_type_ids,
      exclude_asset_vendor_type_ids,
      sort_by,
      sort_type,
      is_provider,
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
      .selectFrom("asset_vendors as av")
      .innerJoin("asset_vendor_types as avt", (join) =>
        join.onRef("av.asset_vendor_type_id", "=", "avt.id")
      )
      .innerJoin("users as uc", (join) =>
        join.onRef("av.created_by", "=", "uc.id")
      )
      .innerJoin("users as uu", (join) =>
        join.onRef("av.updated_by", "=", "uu.id")
      )

    queries = queries.where("av.deleted_at", "is", null)

    if (keyword) {
      queries = queries.where("av.name", "like", `%${keyword}%`)
    }

    if (asset_vendor_type_ids) {
      queries = queries.where("avt.id", "in", asset_vendor_type_ids)
    }

    if (exclude_asset_vendor_type_ids) {
      queries = queries.where("avt.id", "not in", exclude_asset_vendor_type_ids)
    }

    if (typeof is_provider !== "undefined" && is_provider === 1) {
      queries = queries.where(
        "avt.name",
        "=",
        ASSET_MONITORING_DEVICE.COMMUNICATION_PROVIDER_TYPE_NAME
      )
    }

    if (typeof is_provider !== "undefined" && is_provider === 0) {
      queries = queries.where(
        "avt.name",
        "<>",
        ASSET_MONITORING_DEVICE.COMMUNICATION_PROVIDER_TYPE_NAME
      )
    }

    const list = await queries
      .select([
        "av.id",
        "av.name",
        "av.description",
        "av.asset_vendor_type_id",
        "av.created_at",
        "av.updated_at",
        "avt.name as asset_vendor_type_name",
        "uc.id as user_created_id",
        "uc.username as user_created_username",
        "uc.firstname as user_created_firstname",
        "uc.lastname as user_created_lastname",
        sql<string>`TRIM(CONCAT(COALESCE(CAST(${sql.ref("uc.firstname")} AS CHAR), ''),COALESCE(CAST(${sql.ref("uc.lastname")} AS CHAR), '')))`.as(
          "user_created_fullname"
        ),
        "uu.id as user_updated_id",
        "uu.username as user_updated_username",
        "uu.firstname as user_updated_firstname",
        "uu.lastname as user_updated_lastname",
        sql<string>`TRIM(CONCAT(COALESCE(CAST(${sql.ref("uu.firstname")} AS CHAR), ''),COALESCE(CAST(${sql.ref("uu.lastname")} AS CHAR), '')))`.as(
          "user_updated_fullname"
        ),
      ])
      .orderBy(sortBy, sortType)
      .limit(paginate)
      .offset(offset)
      .execute()

    const totalList = await queries
      .select(() => sql`count(distinct ${sql.ref("av.id")})`.as("total"))
      .executeTakeFirst()

    return {
      parentList: list,
      allList: [],
      total: Number(totalList?.total) || 0,
    }
  }

  async getListAssetVendorWithoutPaginate(
    c: Context,
    params: GetAssetVendorsQueryParams
  ) {
    const {
      keyword,
      asset_vendor_type_ids,
      exclude_asset_vendor_type_ids,
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
      .selectFrom("asset_vendors as av")
      .innerJoin("asset_vendor_types as avt", (join) =>
        join.onRef("av.asset_vendor_type_id", "=", "avt.id")
      )
      .innerJoin("users as uc", (join) =>
        join.onRef("av.created_by", "=", "uc.id")
      )
      .innerJoin("users as uu", (join) =>
        join.onRef("av.updated_by", "=", "uu.id")
      )

    queries = queries.where("av.deleted_at", "is", null)

    if (keyword) {
      queries = queries.where("av.name", "like", `%${keyword}%`)
    }

    if (asset_vendor_type_ids) {
      queries = queries.where("avt.id", "in", asset_vendor_type_ids)
    }

    if (exclude_asset_vendor_type_ids) {
      queries = queries.where("avt.id", "not in", exclude_asset_vendor_type_ids)
    }

    const list = await queries
      .select([
        "av.id",
        "av.name",
        "av.description",
        "av.asset_vendor_type_id",
        "av.created_at",
        "av.updated_at",
        "avt.name as asset_vendor_type_name",
        "uc.id as user_created_id",
        "uc.username as user_created_username",
        "uc.firstname as user_created_firstname",
        "uc.lastname as user_created_lastname",
        sql<string>`TRIM(CONCAT(COALESCE(CAST(${sql.ref("uc.firstname")} AS CHAR), ''),COALESCE(CAST(${sql.ref("uc.lastname")} AS CHAR), '')))`.as(
          "user_created_fullname"
        ),
        "uu.id as user_updated_id",
        "uu.username as user_updated_username",
        "uu.firstname as user_updated_firstname",
        "uu.lastname as user_updated_lastname",
        sql<string>`TRIM(CONCAT(COALESCE(CAST(${sql.ref("uu.firstname")} AS CHAR), ''),COALESCE(CAST(${sql.ref("uu.lastname")} AS CHAR), '')))`.as(
          "user_updated_fullname"
        ),
      ])
      .orderBy(sortBy, sortType)
      .execute()

    return { parentList: list, allList: [] }
  }

  async getAssetVendorByName(c: Context, name: string) {
    return await c.var.trx
      .selectFrom("asset_vendors")
      .selectAll()
      .where("name", "=", name)
      .where("deleted_at", "is", null)
      .executeTakeFirst()
  }

  async getAssetVendorTypeById(c: Context, id: number) {
    return await c.var.trx
      .selectFrom("asset_vendor_types")
      .selectAll()
      .where("id", "=", id)
      .where("deleted_at", "is", null)
      .executeTakeFirst()
  }

  async getOnlyAssetVendorById(c: Context, id: number) {
    return await c.var.trx
      .selectFrom("asset_vendors")
      .selectAll()
      .where("id", "=", id)
      .where("deleted_at", "is", null)
      .executeTakeFirst()
  }

  async getAssetVendorTypeByIds(c: Context, ids: number[]) {
    return await c.var.trx
      .selectFrom("asset_vendor_types")
      .selectAll()
      .where("id", "in", ids)
      .where("deleted_at", "is", null)
      .execute()
  }

  getWorkspaceStreamData(c: Context) {
    return c.var.trx
      .selectFrom("workspaces")
      .select(["id", "name"])
      .where("deleted_at", "is", null)
      .orderBy("id")
      .stream()
  }
}
