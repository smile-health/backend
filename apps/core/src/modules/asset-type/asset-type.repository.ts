import {
  ASSET_CLASSIFICATION,
  TYPE_DOWNLOAD_TEMPLATE_ASSET_TYPE,
} from "@/common/constants/assets.js"
import { FLAG } from "@/common/constants/general.js"
import { Context } from "hono"
import { sql } from "kysely"
import { BaseRepository } from "../base.repository.js"
import {
  AddAssetTypeWorkspaceDTO,
  GetAssetTypesQueryParams,
} from "./asset-type.schema.js"

export class AssetTypeRepository extends BaseRepository<"asset_types"> {
  constructor() {
    super("asset_types")
  }

  async createAssetTypeWorkspace(c: Context, req: AddAssetTypeWorkspaceDTO) {
    return await c.var.trx
      .insertInto("asset_type_workspaces")
      .values(req)
      .executeTakeFirst()
  }

  async getAssetTypeWorkspaceByAssetTypeId(c: Context, assetTypeId: number) {
    return await c.var.trx
      .selectFrom("asset_type_workspaces")
      .selectAll()
      .where("asset_type_id", "=", assetTypeId)
      .where("deleted_at", "is", null)
      .execute()
  }

  async getAssetTypeById(c: Context, id: number) {
    return await c.var.trx
      .selectFrom("asset_types as at")
      .leftJoin("integration_associations as ia", (join) =>
        join
          .onRef("ia.internal_id", "=", "at.id")
          .on("ia.type", "=", sql`'asset_type'`)
      )
      .innerJoin("users as uc", (join) =>
        join.onRef("at.created_by", "=", "uc.id")
      )
      .innerJoin("users as uu", (join) =>
        join.onRef("at.updated_by", "=", "uu.id")
      )
      .leftJoin("asset_type_workspaces as atw", (join) =>
        join.onRef("at.id", "=", "atw.asset_type_id")
      )
      .leftJoin("workspaces as w", (join) =>
        join.onRef("atw.workspace_id", "=", "w.id")
      )
      .select([
        "at.id",
        "at.name",
        "at.description",
        "at.min_temperature",
        "at.max_temperature",
        "at.created_at",
        "at.updated_at",
        "atw.status",
        "w.id as program_id",
        "w.key as program_key",
        "w.name as program_name",
        "w.config as program_config",
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
      .where("at.id", "=", id)
      .where("at.deleted_at", "is", null)
      .execute()
  }

  async getListAssetType(c: Context, params: GetAssetTypesQueryParams) {
    const { page, paginate, keyword, program_ids, sort_by, sort_type } = params
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
      .selectFrom("asset_types as at")
      .leftJoin("integration_associations as ia", (join) =>
        join
          .onRef("ia.internal_id", "=", "at.id")
          .on("ia.type", "=", sql`'asset_type'`)
      )
      .innerJoin("users as uc", (join) =>
        join.onRef("at.created_by", "=", "uc.id")
      )
      .innerJoin("users as uu", (join) =>
        join.onRef("at.updated_by", "=", "uu.id")
      )
      .leftJoin("asset_type_workspaces as atw", (join) =>
        join.onRef("at.id", "=", "atw.asset_type_id")
      )
      .leftJoin("workspaces as w", (join) =>
        join.onRef("atw.workspace_id", "=", "w.id")
      )

    queries = queries
      .where("at.deleted_at", "is", null)
      .$if(!!c.var.client, (qb) =>
        qb.where("ia.client_id", "=", c.var.client!.getId())
      )

    if (keyword) {
      queries = queries.where("at.name", "like", `%${keyword}%`)
    }

    let additionalQueries = queries

    if (program_ids && program_ids.length >= 1 && !program_ids.includes(0)) {
      additionalQueries = additionalQueries.where("w.id", "in", program_ids)
    }

    if (program_ids && program_ids.length > 1 && program_ids.includes(0)) {
      additionalQueries = additionalQueries.where((eb) =>
        eb.or([eb("w.id", "in", program_ids), eb("atw.id", "is", null)])
      )
    }

    if (program_ids && program_ids.length === 1 && program_ids.includes(0)) {
      additionalQueries = additionalQueries.where("atw.id", "is", null)
    }

    const [parentList, allList, totalList] = await Promise.all([
      additionalQueries
        .select([
          "at.id",
          (eb) => eb.fn.max("at.name").as("name"),
          (eb) => eb.fn.max("at.description").as("description"),
          (eb) => eb.fn.max("at.min_temperature").as("min_temperature"),
          (eb) => eb.fn.max("at.max_temperature").as("max_temperature"),
          (eb) => eb.fn.max("at.created_at").as("created_at"),
          (eb) => eb.fn.max("at.updated_at").as("updated_at"),
          (eb) => eb.fn.max("uc.id").as("user_created_id"),
          (eb) => eb.fn.max("uc.username").as("user_created_username"),
          (eb) => eb.fn.max("uc.firstname").as("user_created_firstname"),
          (eb) => eb.fn.max("uc.lastname").as("user_created_lastname"),
          (eb) =>
            eb.fn
              .max(
                sql<string>`TRIM(CONCAT_WS(' ',COALESCE(CAST(${sql.ref("uc.firstname")} AS CHAR), ''),COALESCE(CAST(${sql.ref("uc.lastname")} AS CHAR), '')))`
              )
              .as("user_created_fullname"),
          (eb) => eb.fn.max("uu.id").as("user_updated_id"),
          (eb) => eb.fn.max("uu.username").as("user_updated_username"),
          (eb) => eb.fn.max("uu.firstname").as("user_updated_firstname"),
          (eb) => eb.fn.max("uu.lastname").as("user_updated_lastname"),
          (eb) =>
            eb.fn
              .max(
                sql<string>`TRIM(CONCAT_WS(' ',COALESCE(CAST(${sql.ref("uu.firstname")} AS CHAR), ''),COALESCE(CAST(${sql.ref("uu.lastname")} AS CHAR), '')))`
              )
              .as("user_updated_fullname"),
        ])
        .groupBy("at.id")
        .orderBy(sortBy, sortType)
        .limit(paginate)
        .offset(offset)
        .execute(),
      queries
        .select([
          "at.id",
          "w.id as program_id",
          "w.key as program_key",
          "w.name as program_name",
          "w.config as program_config",
        ])
        .execute(),
      additionalQueries
        .select(() => sql`count(distinct ${sql.ref("at.id")})`.as("total"))
        .executeTakeFirst(),
    ])

    return {
      parentList,
      allList,
      total: Number(totalList?.total) || 0,
    }
  }

  async getListAssetTypeWithoutPaginate(
    c: Context,
    params: GetAssetTypesQueryParams
  ) {
    const { keyword, program_ids, sort_by, sort_type } = params

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
      .selectFrom("asset_types as at")
      .leftJoin("integration_associations as ia", (join) =>
        join
          .onRef("ia.internal_id", "=", "at.id")
          .on("ia.type", "=", sql`'asset_type'`)
      )
      .innerJoin("users as uc", (join) =>
        join.onRef("at.created_by", "=", "uc.id")
      )
      .innerJoin("users as uu", (join) =>
        join.onRef("at.updated_by", "=", "uu.id")
      )
      .leftJoin("asset_type_workspaces as atw", (join) =>
        join.onRef("at.id", "=", "atw.asset_type_id")
      )
      .leftJoin("workspaces as w", (join) =>
        join.onRef("atw.workspace_id", "=", "w.id")
      )

    if (keyword) {
      queries = queries.where("at.name", "like", `%${keyword}%`)
    }

    queries = queries.where("at.deleted_at", "is", null)

    let additionalQueries = queries

    if (program_ids && program_ids.length >= 1 && !program_ids.includes(0)) {
      additionalQueries = additionalQueries.where("w.id", "in", program_ids)
    }

    if (program_ids && program_ids.length > 1 && program_ids.includes(0)) {
      additionalQueries = additionalQueries.where((eb) =>
        eb.or([eb("w.id", "in", program_ids), eb("atw.id", "is", null)])
      )
    }

    if (program_ids && program_ids.length === 1 && program_ids.includes(0)) {
      additionalQueries = additionalQueries.where("atw.id", "is", null)
    }

    const [parentList, allList] = await Promise.all([
      additionalQueries
        .select([
          "at.id",
          (eb) => eb.fn.max("at.name").as("name"),
          (eb) => eb.fn.max("at.description").as("description"),
          (eb) => eb.fn.max("at.min_temperature").as("min_temperature"),
          (eb) => eb.fn.max("at.max_temperature").as("max_temperature"),
          (eb) => eb.fn.max("at.created_at").as("created_at"),
          (eb) => eb.fn.max("at.updated_at").as("updated_at"),
          (eb) => eb.fn.max("uc.id").as("user_created_id"),
          (eb) => eb.fn.max("uc.username").as("user_created_username"),
          (eb) => eb.fn.max("uc.firstname").as("user_created_firstname"),
          (eb) => eb.fn.max("uc.lastname").as("user_created_lastname"),
          (eb) =>
            eb.fn
              .max(
                sql<string>`TRIM(CONCAT_WS(' ',COALESCE(CAST(${sql.ref("uc.firstname")} AS CHAR), ''),COALESCE(CAST(${sql.ref("uc.lastname")} AS CHAR), '')))`
              )
              .as("user_created_fullname"),
          (eb) => eb.fn.max("uu.id").as("user_updated_id"),
          (eb) => eb.fn.max("uu.username").as("user_updated_username"),
          (eb) => eb.fn.max("uu.firstname").as("user_updated_firstname"),
          (eb) => eb.fn.max("uu.lastname").as("user_updated_lastname"),
          (eb) =>
            eb.fn
              .max(
                sql<string>`TRIM(CONCAT_WS(' ',COALESCE(CAST(${sql.ref("uu.firstname")} AS CHAR), ''),COALESCE(CAST(${sql.ref("uu.lastname")} AS CHAR), '')))`
              )
              .as("user_updated_fullname"),
        ])
        .groupBy("at.id")
        .orderBy(sortBy, sortType)
        .execute(),
      queries
        .select([
          "at.id",
          "w.id as program_id",
          "w.key as program_key",
          "w.name as program_name",
          "w.config as program_config",
        ])
        .execute(),
    ])

    return { parentList, allList }
  }

  async getAssetTypeByName(c: Context, name: string) {
    return await c.var.trx
      .selectFrom("asset_types")
      .selectAll()
      .where("name", "=", name)
      .where("deleted_at", "is", null)
      .executeTakeFirst()
  }

  async getWorkspacesByIds(c: Context, ids: number[]) {
    return await c.var.trx
      .selectFrom("workspaces")
      .selectAll()
      .where("id", "in", ids)
      .where("deleted_at", "is", null)
      .execute()
  }

  async getOnlyAssetTypeById(c: Context, id: number) {
    return await c.var.trx
      .selectFrom("asset_types")
      .selectAll()
      .where("id", "=", id)
      .where("deleted_at", "is", null)
      .executeTakeFirst()
  }

  getWorkspaceStreamData(c: Context) {
    return c.var.trx
      .selectFrom("workspaces")
      .select(["id", "name"])
      .where("deleted_at", "is", null)
      .orderBy("id")
      .stream()
  }

  getDetailAssetTypeById(c: Context, id: number) {
    return c.var.trx
      .selectFrom("asset_types as at")
      .leftJoin("integration_associations as ia", (join) =>
        join.onRef("ia.internal_id", "=", "at.id")
      )
      .select([
        "at.id",
        "ia.client_id as integration_client_id",
        "at.name",
        "at.description",
        "ia.metadata as external_properties",
        "at.created_at",
        "at.updated_at",
        "at.updated_by",
        "at.created_by",
      ])
      .where("at.id", "=", id)
      .where("at.deleted_at", "is", null)
      .executeTakeFirst()
  }

  getTemperatureThresholdAssetTypeByIds(c: Context, ids: number[]) {
    return c.var.trx
      .selectFrom("asset_types_temperatures as att")
      .innerJoin("temperature_thresholds as tt", (join) =>
        join
          .onRef("att.temperature_threshold_id", "=", "tt.id")
          .on("tt.deleted_at", "is", null)
      )
      .select([
        "att.id as asset_type_temperature_id",
        "att.asset_type_id",
        "tt.id as temperature_threshold_id",
        "tt.min_temperature",
        "tt.max_temperature",
      ])
      .where("att.asset_type_id", "in", ids)
      .where("att.deleted_at", "is", null)
      .execute()
  }

  getTemperatureThresholdStreamData(c: Context, isWarehouse: boolean) {
    return c.var.trx
      .selectFrom("temperature_thresholds")
      .select(["id", "min_temperature", "max_temperature"])
      .where("deleted_at", "is", null)
      .where(
        "is_predefined",
        "=",
        isWarehouse
          ? TYPE_DOWNLOAD_TEMPLATE_ASSET_TYPE.IS_WAREHOUSE
          : TYPE_DOWNLOAD_TEMPLATE_ASSET_TYPE.IS_CCE
      )
      .orderBy("id")
      .stream()
  }

  async fetchAssetTypeIdsByDashboardFilter(
    c: Context,
    dashboardFilter?: string | null
  ) {
    if (!dashboardFilter) {
      return null
    }

    const dashboardConfig = await c.var.trx
      .selectFrom("dashboard_configs")
      .select("config")
      .where("key", "=", dashboardFilter)
      .executeTakeFirst()

    if (!dashboardConfig) {
      return null
    }

    return dashboardConfig.config!["asset_type_ids"]
  }

  async listAssetType(c: Context, params: GetAssetTypesQueryParams) {
    const filteredAssetTypeIds = await this.fetchAssetTypeIdsByDashboardFilter(
      c,
      params.dashboard_filter
    )

    let baseQuery = c.var.trx
      .selectFrom("asset_types as at")
      .leftJoin("integration_associations as ia", (join) =>
        join
          .onRef("ia.internal_id", "=", "at.id")
          .on("ia.type", "=", sql`'asset_type'`)
      )
      .leftJoin(
        (eb) =>
          eb
            .selectFrom("asset_types_classifications as atc")
            .select(["atc.asset_type_id", sql<number>`1`.as("is_cce")])
            .where(
              "atc.asset_classifications_id",
              "=",
              ASSET_CLASSIFICATION.CCE
            )
            .where("atc.deleted_at", "is", null)
            .groupBy("atc.asset_type_id")
            .as("cce_check"),
        (join) => join.onRef("cce_check.asset_type_id", "=", "at.id")
      )
      .leftJoin(
        (eb) =>
          eb
            .selectFrom("asset_models as am")
            .select(["am.asset_type_id", sql<number>`1`.as("is_related")])
            .where("am.deleted_at", "is", null)
            .groupBy("am.asset_type_id")
            .as("model_check"),
        (join) => join.onRef("model_check.asset_type_id", "=", "at.id")
      )
      .where("at.deleted_at", "is", null)
      .$if(filteredAssetTypeIds && filteredAssetTypeIds.length > 0, (qb) =>
        qb.where("at.id", "in", filteredAssetTypeIds)
      )
      // Simplified warehouse filtering - handle all cases in one block
      .$if(
        params.is_warehouse !== undefined ||
          params.is_cce_warehouse !== undefined,
        (qb) => {
          const requiredClassifications: number[] = []
          if (params.is_warehouse === FLAG.TRUE) {
            requiredClassifications.push(ASSET_CLASSIFICATION.WAREHOUSE)
          }
          if (params.is_cce_warehouse === FLAG.TRUE) {
            requiredClassifications.push(ASSET_CLASSIFICATION.CCE_WAREHOUSE)
          }

          const excludedClassifications: number[] = []
          if (params.is_warehouse === FLAG.FALSE) {
            excludedClassifications.push(ASSET_CLASSIFICATION.WAREHOUSE)
          }
          if (params.is_cce_warehouse === FLAG.FALSE) {
            excludedClassifications.push(ASSET_CLASSIFICATION.CCE_WAREHOUSE)
          }

          if (requiredClassifications.length > 0) {
            qb = qb.where(
              "at.id",
              "in",
              c.var.trx
                .selectFrom("asset_types_classifications as atc")
                .select("atc.asset_type_id")
                .where(
                  "atc.asset_classifications_id",
                  "in",
                  requiredClassifications
                )
                .where("atc.deleted_at", "is", null)
                .groupBy("atc.asset_type_id")
                .having(
                  sql`COUNT(DISTINCT atc.asset_classifications_id)`,
                  "=",
                  requiredClassifications.length
                )
            )
          }
          if (excludedClassifications.length > 0) {
            qb = qb.where(
              "at.id",
              "not in",
              c.var.trx
                .selectFrom("asset_types_classifications as atc")
                .select("atc.asset_type_id")
                .where(
                  "atc.asset_classifications_id",
                  "in",
                  excludedClassifications
                )
                .where("atc.deleted_at", "is", null)
            )
          }

          return qb
        }
      )

    if (params.keyword) {
      baseQuery = baseQuery.where("at.name", "like", `%${params.keyword}%`)
    }

    if (params.type_by === "rtmd") {
      baseQuery = baseQuery.where(
        "at.name",
        "=",
        "Remote Temperature Monitoring"
      )
    }

    if (params.is_cce === 1) {
      baseQuery = baseQuery.where("cce_check.is_cce", "is not", null)
    } else if (params.is_cce === 0) {
      baseQuery = baseQuery.where("cce_check.is_cce", "is", null)
    }

    if (params.is_related_asset !== undefined) {
      if (params.is_related_asset === 1) {
        baseQuery = baseQuery.where("model_check.is_related", "is not", null)
      } else if (params.is_related_asset === 0) {
        baseQuery = baseQuery.where("model_check.is_related", "is", null)
      }
    }

    let dataQuery = baseQuery.select([
      "at.id",
      "at.name",
      "at.description",
      "at.created_at",
      "at.updated_at",
      "at.created_by",
      "at.updated_by",
      sql<number>`COALESCE(${sql.ref("cce_check.is_cce")}, 0)`.as("is_cce"),
      sql<number>`COALESCE(${sql.ref("model_check.is_related")}, 0)`.as(
        "is_related_asset"
      ),
    ])

    dataQuery = this.applySorting(dataQuery, params)

    const offset = (params.page - 1) * params.paginate
    const isPaginate = !!params.page && !!params.paginate

    const [list, countResult] = await Promise.all([
      dataQuery
        .$if(isPaginate, (qb) => qb.limit(params.paginate).offset(offset))
        .execute(),
      baseQuery
        .clearSelect()
        .select((eb) => eb.fn.countAll<number>().as("total"))
        .executeTakeFirstOrThrow(),
    ])

    return { data: list, total: Number(countResult.total) }
  }

  getAssetTypesWithDetailStream(c: Context, params: GetAssetTypesQueryParams) {
    let query = c.var.trx
      .selectFrom("asset_types as at")
      .leftJoin("integration_associations as ia", (join) =>
        join
          .onRef("ia.internal_id", "=", "at.id")
          .on("ia.type", "=", sql`'asset_type'`)
      )
      .leftJoin("asset_types_classifications as atc", (join) =>
        join
          .onRef("at.id", "=", "atc.asset_type_id")
          .on("atc.deleted_at", "is", null)
      )
      .leftJoin(
        (eb) =>
          eb
            .selectFrom("asset_types_temperatures as att")
            .innerJoin("temperature_thresholds as tt", (join) =>
              join
                .onRef("att.temperature_threshold_id", "=", "tt.id")
                .on("tt.deleted_at", "is", null)
            )
            .select([
              "att.asset_type_id",
              sql`GROUP_CONCAT(DISTINCT CAST(tt.min_temperature AS CHAR) ORDER BY tt.min_temperature SEPARATOR ', ')`.as(
                "min_temperatures"
              ),
              sql`GROUP_CONCAT(DISTINCT CAST(tt.max_temperature AS CHAR) ORDER BY tt.max_temperature SEPARATOR ', ')`.as(
                "max_temperatures"
              ),
            ])
            .where("att.deleted_at", "is", null)
            .groupBy("att.asset_type_id")
            .as("temp_data"),
        (join) => join.onRef("temp_data.asset_type_id", "=", "at.id")
      )
      .leftJoin("users as u", (join) =>
        join.onRef("at.updated_by", "=", "u.id").on("u.deleted_at", "is", null)
      )
      .select([
        "at.id",
        "at.name",
        "at.description",
        sql`MAX(CASE 
          WHEN atc.asset_classifications_id = ${ASSET_CLASSIFICATION.CCE} THEN 1 
          ELSE 0 
        END)`.as("is_cce"),
        sql`MAX(CASE 
          WHEN atc.asset_classifications_id = ${ASSET_CLASSIFICATION.SELECTION} THEN 1 
          ELSE 0 
        END)`.as("is_adjustable"),
        sql`MAX(temp_data.min_temperatures)`.as("min_temperature"),
        sql`MAX(temp_data.max_temperatures)`.as("max_temperature"),
        sql<string>`
          MAX(CASE
            WHEN (u.firstname IS NOT NULL AND u.firstname != '') 
              AND (u.lastname IS NULL OR u.lastname = '') 
            THEN u.firstname
            WHEN (u.lastname IS NOT NULL AND u.lastname != '') 
              AND (u.firstname IS NULL OR u.firstname = '') 
            THEN u.lastname
            WHEN (u.firstname IS NOT NULL AND u.firstname != '') 
              AND (u.lastname IS NOT NULL AND u.lastname != '') 
            THEN CONCAT(u.firstname, ' ', u.lastname)
            ELSE ''
          END)
        `.as("updated_by_name"),
        "at.updated_by",
        "at.updated_at",
      ])
      .where("at.deleted_at", "is", null)

    if (params.keyword) {
      query = query.where("at.name", "like", `%${params.keyword}%`)
    }

    if (params.is_cce !== undefined) {
      if (params.is_cce === 1) {
        query = query.where(
          "at.id",
          "in",
          c.var.trx
            .selectFrom("asset_types_classifications")
            .select("asset_type_id")
            .where("asset_classifications_id", "=", ASSET_CLASSIFICATION.CCE)
            .where("deleted_at", "is", null)
        )
      } else if (params.is_cce === 0) {
        query = query.where(
          "at.id",
          "not in",
          c.var.trx
            .selectFrom("asset_types_classifications")
            .select("asset_type_id")
            .where("asset_classifications_id", "=", ASSET_CLASSIFICATION.CCE)
            .where("deleted_at", "is", null)
        )
      }
    }

    if (params.type_by === "rtmd") {
      query = query.where("at.name", "=", "Remote Temperature Monitoring")
    }

    query = this.applySorting(query, params)

    return query
      .groupBy(["at.id", "at.name", "at.description", "at.updated_at"])
      .stream()
  }

  private applySorting(query: any, queryParam: GetAssetTypesQueryParams) {
    const sortMapping = {
      name: "at.name",
      updated_at: "at.updated_at",
    }

    if (queryParam.sort_by && sortMapping[queryParam.sort_by]) {
      const order =
        queryParam.sort_type?.toLowerCase() === "desc" ? "desc" : "asc"
      query = query.orderBy(sortMapping[queryParam.sort_by], order)
    }

    return query
  }
}
