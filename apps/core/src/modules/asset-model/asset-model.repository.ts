import { Context } from "hono"
import { BaseRepository } from "../base.repository.js"
import {
  AddAssetModelWorkspaceDTO,
  GetAssetModelsQueryParams,
} from "./asset-model.schema.js"
import { sql } from "kysely"
import { ASSET_CLASSIFICATION } from "@/common/constants/assets.js"

export class AssetModelRepository extends BaseRepository<"asset_models"> {
  constructor() {
    super("asset_models")
  }

  async createAssetModelWorkspace(c: Context, req: AddAssetModelWorkspaceDTO) {
    return await c.var.trx
      .insertInto("asset_model_workspaces")
      .values(req)
      .executeTakeFirst()
  }

  async getAssetModelWorkspaceByAssetModelId(c: Context, assetModelId: number) {
    return await c.var.trx
      .selectFrom("asset_model_workspaces")
      .selectAll()
      .where("asset_model_id", "=", assetModelId)
      .where("deleted_at", "is", null)
      .execute()
  }

  async getAssetModelById(c: Context, id: number) {
    return await c.var.trx
      .selectFrom("asset_models as am")
      .innerJoin("asset_types as at", (join) =>
        join
          .onRef("am.asset_type_id", "=", "at.id")
          .on("at.deleted_at", "is", null)
      )
      .innerJoin("manufactures as m", (join) =>
        join
          .onRef("am.manufacture_id", "=", "m.id")
          .on("m.deleted_at", "is", null)
      )
      .select([
        "am.id",
        "am.pqs_code_id",
        "am.asset_type_id",
        "am.manufacture_id",
        "am.created_by",
        "am.updated_by",
        "am.created_at",
        "am.updated_at",
        "am.name as asset_model_name",
        "at.name as asset_type_name",
        "m.name as manufacture_name",
      ])
      .where("am.id", "=", id)
      .where("am.deleted_at", "is", null)
      .executeTakeFirst()
  }

  async getListAssetModel(c: Context, params: GetAssetModelsQueryParams) {
    const {
      page,
      paginate,
      keyword,
      sort_by,
      sort_type,
      manufacture_ids,
      asset_type_ids,
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
      .selectFrom("asset_models as am")
      .innerJoin("asset_types as at", (join) =>
        join
          .onRef("am.asset_type_id", "=", "at.id")
          .on("at.deleted_at", "is", null)
      )
      .innerJoin("manufactures as m", (join) =>
        join
          .onRef("am.manufacture_id", "=", "m.id")
          .on("m.deleted_at", "is", null)
      )

    queries = queries.where("am.deleted_at", "is", null)

    if (keyword) {
      queries = queries.where("am.name", "like", `%${keyword}%`)
    }

    if (manufacture_ids) {
      queries = queries.where("am.manufacture_id", "in", manufacture_ids)
    }

    if (asset_type_ids) {
      queries = queries.where("am.asset_type_id", "in", asset_type_ids)
    }

    let additionalQueries = queries

    const [parentList, totalList] = await Promise.all([
      additionalQueries
        .select([
          "am.id",
          (eb) => eb.fn.max("am.name").as("name"),
          (eb) => eb.fn.max("am.asset_type_id").as("asset_type_id"),
          (eb) => eb.fn.max("am.created_by").as("created_by"),
          (eb) => eb.fn.max("am.updated_by").as("updated_by"),
          (eb) => eb.fn.max("at.name").as("asset_type_name"),
          (eb) =>
            eb.fn.max("at.min_temperature").as("asset_type_min_temperature"),
          (eb) =>
            eb.fn.max("at.max_temperature").as("asset_type_max_temperature"),
          (eb) => eb.fn.max("am.manufacture_id").as("manufacture_id"),
          (eb) => eb.fn.max("m.name").as("manufacture_name"),
          (eb) => eb.fn.max("am.net_capacity").as("net_capacity"),
          (eb) => eb.fn.max("am.gross_capacity").as("gross_capacity"),
          (eb) => eb.fn.max("am.created_at").as("created_at"),
          (eb) => eb.fn.max("am.updated_at").as("updated_at"),
        ])
        .groupBy("am.id")
        .orderBy(sortBy, sortType)
        .limit(paginate)
        .offset(offset)
        .execute(),
      additionalQueries
        .select(() => sql`count(distinct ${sql.ref("am.id")})`.as("total"))
        .executeTakeFirst(),
    ])

    return {
      parentList,
      total: Number(totalList?.total) || 0,
    }
  }

  async getListAssetModelWithoutPaginate(
    c: Context,
    params: GetAssetModelsQueryParams
  ) {
    const { keyword, manufacture_ids, asset_type_ids } = params

    let queries = c.var.trx
      .selectFrom("asset_models as am")
      .innerJoin("asset_types as at", (join) =>
        join
          .onRef("am.asset_type_id", "=", "at.id")
          .on("at.deleted_at", "is", null)
      )
      .innerJoin("manufactures as m", (join) =>
        join
          .onRef("am.manufacture_id", "=", "m.id")
          .on("m.deleted_at", "is", null)
      )
      .leftJoin("users as u", (join) =>
        join.onRef("am.updated_by", "=", "u.id").on("u.deleted_at", "is", null)
      )
      .leftJoin("asset_models_temperatures_capacities as amtc", (join) =>
        join
          .onRef("am.id", "=", "amtc.asset_model_id")
          .on("amtc.deleted_at", "is", null)
      )
      .leftJoin("asset_types_temperatures as att", (join) =>
        join
          .onRef("amtc.asset_type_temperature_id", "=", "att.id")
          .on("att.deleted_at", "is", null)
      )
      .leftJoin("temperature_thresholds as tt", (join) =>
        join
          .onRef("att.temperature_threshold_id", "=", "tt.id")
          .on("tt.deleted_at", "is", null)
      )
      .leftJoin("asset_models_non_temperatures_capacities as amntc", (join) =>
        join
          .onRef("am.id", "=", "amntc.asset_model_id")
          .on("amntc.deleted_at", "is", null)
      )
      .leftJoin("pqs_codes as pqsc", (join) =>
        join
          .onRef("pqsc.id", "=", "am.pqs_code_id")
          .on("pqsc.deleted_at", "is", null)
      )

    queries = queries.where("am.deleted_at", "is", null)

    if (keyword) {
      queries = queries.where("am.name", "like", `%${keyword}%`)
    }

    if (manufacture_ids) {
      queries = queries.where("am.manufacture_id", "in", manufacture_ids)
    }

    if (asset_type_ids) {
      queries = queries.where("am.asset_type_id", "in", asset_type_ids)
    }

    queries = this.applySorting(queries, params)

    const result = await queries
      .select([
        "am.id as model_id",
        "am.name as model_name",
        "am.asset_type_id",
        "at.name as asset_type_name",
        "am.manufacture_id",
        "m.name as manufacture_name",
        "pqsc.code as pqs_code",
        sql<number>`MAX(CASE WHEN amntc.id = (
        SELECT MIN(id) FROM asset_models_non_temperatures_capacities 
        WHERE asset_model_id = am.id AND deleted_at IS NULL
      ) THEN amntc.gross_capacity END)`.as("gross_capacity_1"),
        sql<number>`MAX(CASE WHEN amntc.id = (
        SELECT MIN(id) FROM asset_models_non_temperatures_capacities 
        WHERE asset_model_id = am.id AND deleted_at IS NULL
      ) THEN amntc.net_capacity END)`.as("nett_capacity_1"),
        sql<number>`MAX(CASE WHEN amntc.id = (
        SELECT id FROM asset_models_non_temperatures_capacities 
        WHERE asset_model_id = am.id AND deleted_at IS NULL
        ORDER BY id LIMIT 1 OFFSET 1
      ) THEN amntc.gross_capacity END)`.as("gross_capacity_2"),
        sql<number>`MAX(CASE WHEN amntc.id = (
        SELECT id FROM asset_models_non_temperatures_capacities 
        WHERE asset_model_id = am.id AND deleted_at IS NULL
        ORDER BY id LIMIT 1 OFFSET 1
      ) THEN amntc.net_capacity END)`.as("nett_capacity_2"),
        sql<number>`MAX(CASE WHEN amntc.id = (
        SELECT id FROM asset_models_non_temperatures_capacities 
        WHERE asset_model_id = am.id AND deleted_at IS NULL
        ORDER BY id LIMIT 1 OFFSET 2
      ) THEN amntc.gross_capacity END)`.as("gross_capacity_3"),
        sql<number>`MAX(CASE WHEN amntc.id = (
        SELECT id FROM asset_models_non_temperatures_capacities 
        WHERE asset_model_id = am.id AND deleted_at IS NULL
        ORDER BY id LIMIT 1 OFFSET 2
      ) THEN amntc.net_capacity END)`.as("nett_capacity_3"),
        sql<number>`MAX(CASE 
        WHEN tt.min_temperature = 2 AND tt.max_temperature = 8 AND tt.is_predefined = 1
        THEN amtc.net_capacity 
      END)`.as("capacity_nett_plus_5"),
        sql<number>`MAX(CASE 
        WHEN tt.min_temperature = -25 AND tt.max_temperature = -15 AND tt.is_predefined = 1
        THEN amtc.net_capacity 
      END)`.as("capacity_nett_minus_20"),
        sql<number>`MAX(CASE 
        WHEN tt.min_temperature = -86  AND tt.max_temperature = -40 AND tt.is_predefined = 1
        THEN amtc.net_capacity 
      END)`.as("capacity_nett_minus_86"),
        sql<number>`MAX(CASE
          WHEN tt.min_temperature = 2 AND tt.max_temperature = 8 AND tt.is_predefined = 1
          THEN amtc.gross_capacity 
        END
        )`.as("gross_capacity_plus_5"),
        sql<number>`MAX(CASE
          WHEN tt.min_temperature = -25 AND tt.max_temperature = -15 AND tt.is_predefined = 1
          THEN amtc.gross_capacity 
        END
        )`.as("gross_capacity_minus_20"),
        sql<number>`MAX(CASE
          WHEN tt.min_temperature = -86  AND tt.max_temperature = -40 AND tt.is_predefined = 1
          THEN amtc.gross_capacity 
        END
        )`.as("gross_capacity_minus_86"),
        sql<string>`
        CASE
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
        END
      `.as("updated_by_name"),
        "am.updated_at as date_updated",
      ])
      .groupBy([
        "am.id",
        "am.name",
        "am.asset_type_id",
        "at.name",
        "am.manufacture_id",
        "m.name",
        "am.updated_at",
        "u.firstname",
        "u.lastname",
      ])
      .stream()

    return result
  }

  async getAssetModelByName(c: Context, name: string) {
    return await c.var.trx
      .selectFrom("asset_models")
      .selectAll()
      .where("name", "=", name)
      .where("asset_models.deleted_at", "is", null)
      .executeTakeFirst()
  }

  async getAssetTypeById(c: Context, id: number) {
    return await c.var.trx
      .selectFrom("asset_types as at")
      .leftJoin("asset_types_classifications as atc", (join) =>
        join
          .onRef("at.id", "=", "atc.asset_type_id")
          .on("atc.deleted_at", "is", null)
          .on("atc.asset_classifications_id", "=", ASSET_CLASSIFICATION.CCE)
      )
      .selectAll("at")
      .select(["atc.asset_classifications_id"])
      .where("at.id", "=", id)
      .where("at.deleted_at", "is", null)
      .executeTakeFirst()
  }

  async getManufactureById(c: Context, id: number) {
    return await c.var.trx
      .selectFrom("manufactures")
      .selectAll()
      .where("id", "=", id)
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

  async getOnlyAssetModelById(c: Context, id: number) {
    return await c.var.trx
      .selectFrom("asset_models")
      .selectAll()
      .where("id", "=", id)
      .where("deleted_at", "is", null)
      .executeTakeFirst()
  }

  async getAssetTypeWorkspacesByIds(
    c: Context,
    assetTypeId: number,
    workspaceIds: number[]
  ) {
    return await c.var.trx
      .selectFrom("asset_type_workspaces")
      .selectAll()
      .where("asset_type_id", "=", assetTypeId)
      .where("workspace_id", "in", workspaceIds)
      .where("deleted_at", "is", null)
      .execute()
  }

  async getManufactureWorkspacesByIds(
    c: Context,
    manufactureId: number,
    workspaceIds: number[]
  ) {
    return await c.var.trx
      .selectFrom("manufacture_workspaces")
      .selectAll()
      .where("manufacture_id", "=", manufactureId)
      .where("workspace_id", "in", workspaceIds)
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

  getManufactureStreamData(c: Context) {
    return c.var.trx
      .selectFrom("manufactures")
      .select(["id", "name"])
      .where("status", "=", 1)
      .where("deleted_at", "is", null)
      .orderBy("id")
      .stream()
  }

  getAssetTypeStreamData(c: Context, is_cce: number) {
    return c.var.trx
      .selectFrom("asset_types as at")
      .leftJoin("asset_types_classifications as atc", (join) =>
        join
          .onRef("at.id", "=", "atc.asset_type_id")
          .on("atc.deleted_at", "is", null)
      )
      .leftJoin("asset_types_temperatures as att", (join) =>
        join
          .onRef("at.id", "=", "att.asset_type_id")
          .on("att.deleted_at", "is", null)
      )
      .leftJoin("temperature_thresholds as tt", (join) =>
        join
          .onRef("att.temperature_threshold_id", "=", "tt.id")
          .on("tt.deleted_at", "is", null)
          .on("tt.is_predefined", "=", 1)
      )
      .select([
        "at.id",
        "at.name",
        sql<string>`
          CASE 
            WHEN atc.asset_classifications_id = 1 THEN
              TRIM(
                BOTH ', ' FROM
                CONCAT(
                  COALESCE(
                    (
                      SELECT GROUP_CONCAT(CONCAT('+5°C: ', tt2.min_temperature, '°C to ', tt2.max_temperature, '°C') SEPARATOR ', ')
                      FROM asset_types_temperatures att2
                      INNER JOIN temperature_thresholds tt2 
                        ON att2.temperature_threshold_id = tt2.id 
                        AND tt2.deleted_at IS NULL
                        AND tt2.is_predefined = 1
                      WHERE att2.asset_type_id = at.id 
                        AND att2.deleted_at IS NULL
                        AND tt2.min_temperature = 2 
                        AND tt2.max_temperature = 8
                    ),
                    ''
                  ),
                  CASE 
                    WHEN EXISTS (
                      SELECT 1 
                      FROM asset_types_temperatures att2
                      INNER JOIN temperature_thresholds tt2 
                        ON att2.temperature_threshold_id = tt2.id 
                        AND tt2.deleted_at IS NULL
                        AND tt2.is_predefined = 1
                      WHERE att2.asset_type_id = at.id 
                        AND att2.deleted_at IS NULL
                        AND tt2.min_temperature = -25 
                        AND tt2.max_temperature = -15
                    )
                    THEN CONCAT(
                      ', ',
                      (
                        SELECT GROUP_CONCAT(CONCAT('-20°C: ', tt2.min_temperature, '°C to ', tt2.max_temperature, '°C') SEPARATOR ', ')
                        FROM asset_types_temperatures att2
                        INNER JOIN temperature_thresholds tt2 
                          ON att2.temperature_threshold_id = tt2.id 
                          AND tt2.deleted_at IS NULL
                          AND tt2.is_predefined = 1
                        WHERE att2.asset_type_id = at.id 
                          AND att2.deleted_at IS NULL
                          AND tt2.min_temperature = -25 
                          AND tt2.max_temperature = -15
                      )
                    )
                    ELSE ''
                  END,
                  CASE 
                    WHEN EXISTS (
                      SELECT 1 
                      FROM asset_types_temperatures att2
                      INNER JOIN temperature_thresholds tt2 
                        ON att2.temperature_threshold_id = tt2.id 
                        AND tt2.deleted_at IS NULL
                        AND tt2.is_predefined = 1
                      WHERE att2.asset_type_id = at.id 
                        AND att2.deleted_at IS NULL
                        AND tt2.min_temperature = -86 
                        AND tt2.max_temperature = -40
                    )
                    THEN CONCAT(
                      ', ',
                      (
                        SELECT GROUP_CONCAT(CONCAT('-86°C: ', tt2.min_temperature, '°C to ', tt2.max_temperature, '°C') SEPARATOR ', ')
                        FROM asset_types_temperatures att2
                        INNER JOIN temperature_thresholds tt2 
                          ON att2.temperature_threshold_id = tt2.id 
                          AND tt2.deleted_at IS NULL
                          AND tt2.is_predefined = 1
                        WHERE att2.asset_type_id = at.id 
                          AND att2.deleted_at IS NULL
                          AND tt2.min_temperature = -86 
                          AND tt2.max_temperature = -40
                      )
                    )
                    ELSE ''
                  END
                )
              )
            ELSE ''
          END
        `.as("thresholds"),
        sql<number>`
          CASE 
            WHEN atc.asset_classifications_id = 1 THEN 1
            ELSE 0
          END
        `.as("is_cce"),
      ])
      .where("at.deleted_at", "is", null)
      .where((eb) =>
        is_cce === 1
          ? eb("atc.asset_classifications_id", "=", 1)
          : eb("atc.asset_classifications_id", "!=", 1).or(
              "atc.asset_classifications_id",
              "is",
              null
            )
      )
      .groupBy(["at.id", "at.name", "atc.asset_classifications_id"])
      .orderBy("at.id")
      .stream()
  }

  async createAssetModelTemperatureCapacity(c: Context, data: any) {
    return await c.var.trx
      .insertInto("asset_models_temperatures_capacities")
      .values(data)
      .executeTakeFirstOrThrow()
  }

  async updateAssetModelTemperatureCapacity(c: Context, data: any, id: number) {
    return await c.var.trx
      .updateTable("asset_models_temperatures_capacities")
      .set(data)
      .where("id", "=", id)
      .execute()
  }

  async createAssetModelNonTemperatureCapacity(c: Context, data: any) {
    return await c.var.trx
      .insertInto("asset_models_non_temperatures_capacities")
      .values(data)
      .executeTakeFirstOrThrow()
  }

  async updateAssetModelNonTemperatureCapacity(
    c: Context,
    data: any,
    id: number
  ) {
    return await c.var.trx
      .updateTable("asset_models_non_temperatures_capacities")
      .set(data)
      .where("id", "=", id)
      .execute()
  }

  async getCapacityTemperatureByAssetModelId(c: Context, ids: number[]) {
    return await c.var.trx
      .selectFrom("asset_models_temperatures_capacities as amtc")
      .innerJoin("asset_types_temperatures as att", (join) =>
        join
          .onRef("amtc.asset_type_temperature_id", "=", "att.id")
          .on("att.deleted_at", "is", null)
      )
      .innerJoin("temperature_thresholds as tt", (join) =>
        join
          .onRef("att.temperature_threshold_id", "=", "tt.id")
          .on("tt.deleted_at", "is", null)
      )
      .select([
        "amtc.id",
        "amtc.asset_model_id",
        "amtc.net_capacity",
        "amtc.gross_capacity",
        "tt.min_temperature",
        "tt.max_temperature",
        "tt.id as temperature_threshold_id",
      ])
      .where("amtc.asset_model_id", "in", ids)
      .where("amtc.deleted_at", "is", null)
      .execute()
  }

  async getNetCapacityTemperatureWHOPqs(c: Context, pqsId: number) {
    return await c.var.trx
      .selectFrom("pqs_codes as pc")
      .innerJoin("pqs_net_capacities as pnc", (join) =>
        join
          .onRef("pc.id", "=", "pnc.pqs_code_id")
          .on("pnc.deleted_at", "is", null)
      )
      .innerJoin("temperature_thresholds as tt", (join) =>
        join
          .onRef("pnc.temperature_threshold_id", "=", "tt.id")
          .on("tt.deleted_at", "is", null)
      )
      .select([
        "pnc.net_capacity",
        "tt.min_temperature",
        "tt.max_temperature",
        "pc.code",
      ])
      .where("pc.id", "=", pqsId)
      .where("pc.deleted_at", "is", null)
      .execute()
  }

  async getCapacityNonTemperatureByAssetModelIds(c: Context, ids: number[]) {
    return await c.var.trx
      .selectFrom("asset_models_non_temperatures_capacities as amntc")
      .select([
        "amntc.id",
        "amntc.net_capacity",
        "amntc.gross_capacity",
        "amntc.asset_model_id",
      ])
      .where("amntc.asset_model_id", "in", ids)
      .where("amntc.deleted_at", "is", null)
      .execute()
  }

  getPQSWithCapacitiesStream(c: Context) {
    const result = c.var.trx
      .selectFrom("pqs_codes as pc")
      .leftJoin("pqs_net_capacities as pnc", (join) =>
        join
          .onRef("pc.id", "=", "pnc.pqs_code_id")
          .on("pnc.deleted_at", "is", null)
      )
      .leftJoin("temperature_thresholds as tt", (join) =>
        join
          .onRef("pnc.temperature_threshold_id", "=", "tt.id")
          .on("tt.deleted_at", "is", null)
          .on("tt.is_predefined", "=", 1)
      )
      .select([
        "pc.id",
        sql<string>`
        CONCAT(
          pc.code,
          ' ([',
          TRIM(
            BOTH ', ' FROM
            CONCAT(
              COALESCE(
                (
                  SELECT GROUP_CONCAT(CONCAT('+5°C: ', pnc2.net_capacity, ' litre') SEPARATOR ', ')
                  FROM pqs_net_capacities pnc2
                  INNER JOIN temperature_thresholds tt2 
                    ON pnc2.temperature_threshold_id = tt2.id 
                    AND tt2.deleted_at IS NULL
                    AND tt2.is_predefined = 1
                  WHERE pnc2.pqs_code_id = pc.id 
                    AND pnc2.deleted_at IS NULL
                    AND tt2.min_temperature = 2 
                    AND tt2.max_temperature = 8
                ),
                ''
              ),
              CASE 
                WHEN EXISTS (
                  SELECT 1 
                  FROM pqs_net_capacities pnc2
                  INNER JOIN temperature_thresholds tt2 
                    ON pnc2.temperature_threshold_id = tt2.id 
                    AND tt2.deleted_at IS NULL
                    AND tt2.is_predefined = 1
                  WHERE pnc2.pqs_code_id = pc.id 
                    AND pnc2.deleted_at IS NULL
                    AND tt2.min_temperature = -25 
                    AND tt2.max_temperature = -15
                )
                THEN CONCAT(
                  ', ',
                  (
                    SELECT GROUP_CONCAT(CONCAT('-20°C: ', pnc2.net_capacity, ' litre') SEPARATOR ', ')
                    FROM pqs_net_capacities pnc2
                    INNER JOIN temperature_thresholds tt2 
                      ON pnc2.temperature_threshold_id = tt2.id 
                      AND tt2.deleted_at IS NULL
                      AND tt2.is_predefined = 1
                    WHERE pnc2.pqs_code_id = pc.id 
                      AND pnc2.deleted_at IS NULL
                      AND tt2.min_temperature = -25 
                      AND tt2.max_temperature = -15
                  )
                )
                ELSE ''
              END,
              CASE 
                WHEN EXISTS (
                  SELECT 1 
                  FROM pqs_net_capacities pnc2
                  INNER JOIN temperature_thresholds tt2 
                    ON pnc2.temperature_threshold_id = tt2.id 
                    AND tt2.deleted_at IS NULL
                    AND tt2.is_predefined = 1
                  WHERE pnc2.pqs_code_id = pc.id 
                    AND pnc2.deleted_at IS NULL
                    AND tt2.min_temperature = -86 
                    AND tt2.max_temperature = -40
                )
                THEN CONCAT(
                  ', ',
                  (
                    SELECT GROUP_CONCAT(CONCAT('-86°C: ', pnc2.net_capacity, ' litre') SEPARATOR ', ')
                    FROM pqs_net_capacities pnc2
                    INNER JOIN temperature_thresholds tt2 
                      ON pnc2.temperature_threshold_id = tt2.id 
                      AND tt2.deleted_at IS NULL
                      AND tt2.is_predefined = 1
                    WHERE pnc2.pqs_code_id = pc.id 
                      AND pnc2.deleted_at IS NULL
                      AND tt2.min_temperature = -86 
                      AND tt2.max_temperature = -40
                  )
                )
                ELSE ''
              END
            )
          ),
          '])'
        )
      `.as("name"),
      ])
      .where("pc.deleted_at", "is", null)
      .groupBy(["pc.id", "pc.code"])
      .stream()

    return result
  }

  async findAssetMonitoringDeviceByAssetModelId(
    c: Context,
    assetModelId: number
  ) {
    return await c.var.trx
      .selectFrom("asset_rtmds")
      .where("asset_model_id", "=", assetModelId)
      .where("deleted_at", "is", null)
      .select(["id"])
      .executeTakeFirst()
  }

  private applySorting(query: any, queryParam: GetAssetModelsQueryParams) {
    const sortMapping = {
      name: "am.name",
      updated_at: "am.updated_at",
    }

    if (queryParam.sort_by && sortMapping[queryParam.sort_by]) {
      const order =
        queryParam.sort_type?.toLowerCase() === "desc" ? "desc" : "asc"
      query = query.orderBy(sortMapping[queryParam.sort_by], order)
    }

    return query
  }
}
