import { Context } from "hono"
import { BaseRepository } from "../base.repository.js"
import { GetWhoPqsQueryParams } from "./who-pqs.schema.js"
import { sql } from "kysely"

type Options = {
  paginate?: boolean
}

export class WhoPqsRepository extends BaseRepository<"pqs_codes"> {
  constructor() {
    super("pqs_codes")
  }

  private applySorting(query: any, queryParam: GetWhoPqsQueryParams) {
    const sortMapping = {
      code: "pc.code",
      updated_at: "pc.updated_at",
    }

    if (queryParam.sort_by && sortMapping[queryParam.sort_by]) {
      const order =
        queryParam.sort_type?.toLowerCase() === "desc" ? "desc" : "asc"
      query = query.orderBy(sortMapping[queryParam.sort_by], order)
    }

    return query
  }

  async list(c: Context, queryParam: GetWhoPqsQueryParams) {
    let query = c.var.trx
      .selectFrom("pqs_codes as pc")
      .innerJoin("pqs_types as pt", (join) =>
        join
          .onRef("pt.id", "=", "pc.pqs_type_id")
          .on("pt.deleted_at", "is", null)
      )
      .leftJoin("cceigat_descriptions as cd", (join) =>
        join
          .onRef("cd.id", "=", "pc.cceigat_description_id")
          .on("cd.deleted_at", "is", null)
      )
      .where("pc.deleted_at", "is", null)
      .select([
        "pc.id",
        "pc.code as pqs_code",
        "pc.updated_by",
        "pc.created_by",
        "pc.updated_at",
        "pc.created_at",
        "pt.name as pqs_type_name",
        "cd.name as description",
      ])

    // Filter keyword
    if (queryParam.keyword) {
      query = query.where((eb) =>
        eb("pc.code", "like", `%${queryParam.keyword}%`)
      )
    }

    query = this.applySorting(query, queryParam)

    const offset = (queryParam.page - 1) * queryParam.paginate
    const isPaginate = !!queryParam.page && !!queryParam.paginate

    const [list, count] = await Promise.all([
      query
        .$if(isPaginate, (qb) => qb.limit(queryParam.paginate).offset(offset))
        .execute(),
      query
        .clearSelect()
        .select((eb) => eb.fn.count("pc.id").as("total"))
        .executeTakeFirstOrThrow(),
    ])

    return {
      data: list,
      total: Number((count as { total: string | number }).total),
    }
  }

  async getListPqsNetCapacities(
    c: Context,
    pqsCodeIds: number[],
    isDeleted: boolean = true
  ) {
    const query = await c.var.trx
      .selectFrom("pqs_net_capacities as pnc")
      .innerJoin("temperature_thresholds as tt", (join) =>
        join
          .onRef("pnc.temperature_threshold_id", "=", "tt.id")
          .on("tt.deleted_at", "is", null)
      )
      .where("pnc.pqs_code_id", "in", pqsCodeIds)
      .$if(isDeleted, (qb) => qb.where("pnc.deleted_at", "is", null))
      .select([
        "pnc.id",
        "pnc.pqs_code_id",
        "pnc.net_capacity",
        "tt.id as temperature_threshold_id",
        "tt.max_temperature",
        "tt.min_temperature",
        "tt.is_predefined",
      ])
      .execute()

    return query
  }

  async getListPqsNetCapacitiesByIds(
    c: Context,
    ids: number[],
    pqsCodeId: number
  ) {
    const query = await c.var.trx
      .selectFrom("pqs_net_capacities as pnc")
      .innerJoin("temperature_thresholds as tt", (join) =>
        join
          .onRef("pnc.temperature_threshold_id", "=", "tt.id")
          .on("tt.deleted_at", "is", null)
      )
      .where("pnc.id", "in", ids)
      .where("pnc.pqs_code_id", "=", pqsCodeId)
      .where("pnc.deleted_at", "is", null)
      .select([
        "pnc.id",
        "pnc.pqs_code_id",
        "pnc.net_capacity",
        "tt.max_temperature",
        "tt.min_temperature",
        "tt.is_predefined",
      ])
      .execute()

    return query
  }

  async detail(c: Context, id: number) {
    const detail = await c.var.trx
      .selectFrom("pqs_codes as pc")
      .innerJoin("pqs_types as pt", "pt.id", "pc.pqs_type_id")
      .leftJoin(
        "cceigat_descriptions as cd",
        "cd.id",
        "pc.cceigat_description_id"
      )
      .where("pc.id", "=", id)
      .where("pc.deleted_at", "is", null)
      .select([
        "pc.id",
        "pc.code as pqs_code",
        "pc.updated_by",
        "pc.created_by",
        "pc.cceigat_description_id",
        "pc.pqs_type_id",
        "pc.updated_at",
        "pc.created_at",
        "pt.name as pqs_type_name",
        "cd.name as description",
      ])
      .executeTakeFirst()

    return detail
  }

  async getExportWhoPqs(c: Context, queryParam: GetWhoPqsQueryParams) {
    let query = c.var.trx
      .selectFrom("pqs_codes as pc")
      .innerJoin("pqs_types as pt", (join) =>
        join
          .onRef("pt.id", "=", "pc.pqs_type_id")
          .on("pt.deleted_at", "is", null)
      )
      .leftJoin("cceigat_descriptions as cd", (join) =>
        join
          .onRef("cd.id", "=", "pc.cceigat_description_id")
          .on("cd.deleted_at", "is", null)
      )
      .leftJoin("users as u", (join) =>
        join.onRef("u.id", "=", "pc.updated_by").on("u.deleted_at", "is", null)
      )
      .where("pc.deleted_at", "is", null)
      .select([
        "pc.id",
        "pc.code as pqs_code",
        "pc.updated_by",
        "pc.created_by",
        "pt.name as pqs_type_name",
        "pc.updated_at",
        "cd.name as description",
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
      ])

    // Filter keyword
    if (queryParam.keyword) {
      query = query.where((eb) =>
        eb("pc.code", "like", `%${queryParam.keyword}%`)
      )
    }

    query = this.applySorting(query, queryParam)

    const result = await query.execute()

    return result
  }

  async getTemperatureThresholds(
    c: Context,
    isPredefined: number,
    minTemp: number[],
    maxTemp: number[]
  ) {
    const query = await c.var.trx
      .selectFrom("temperature_thresholds")
      .where("is_predefined", "=", isPredefined)
      .where("min_temperature", "in", minTemp)
      .where("max_temperature", "in", maxTemp)
      .where("deleted_at", "is", null)
      .select(["id", "is_predefined", "max_temperature", "min_temperature"])
      .execute()

    return query
  }
  async createNetCapacity(c: Context, data: any) {
    const query = await c.var.trx
      .insertInto("pqs_net_capacities")
      .values(data)
      .executeTakeFirstOrThrow()

    return query
  }

  async updateNetCapacity(c: Context, id: number, data: any) {
    const query = await c.var.trx
      .updateTable("pqs_net_capacities")
      .set(data)
      .where("id", "=", id)
      .executeTakeFirstOrThrow()

    return query
  }

  async getNetCapacityById(c: Context, id: number) {
    const query = await c.var.trx
      .selectFrom("pqs_net_capacities")
      .where("pqs_code_id", "=", id)
      .where("deleted_at", "is", null)
      .selectAll()
      .execute()

    return query
  }
}
