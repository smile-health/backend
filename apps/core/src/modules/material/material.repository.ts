import { DB } from "@/common/infrastructure/database/types/db.js"
import { Context } from "hono"
import { ComparisonOperatorExpression, ReferenceExpression, sql } from "kysely"
import { BaseRepository } from "../base.repository.js"
import { GetMaterialsQueryParams } from "./material.schema.js"

type Options = {
  paginate?: boolean
}

export class MaterialRepository extends BaseRepository<"materials"> {
  constructor() {
    super("materials")
  }

  async findAll(
    c: Context,
    queryParam: GetMaterialsQueryParams,
    options: Options = { paginate: true }
  ) {
    let query = this.initializeQuery(c)

    query = this.applyFilters(query, queryParam)
    query = this.applySorting(query, queryParam)

    const offset = (queryParam.page - 1) * queryParam.paginate
    const isPaginate =
      !!queryParam.page && !!queryParam.paginate && !!options.paginate

    const [list, count] = await Promise.all([
      query
        .$if(isPaginate, (qb) => qb.limit(queryParam.paginate).offset(offset))
        .select([
          "m.id",
          "m.name",
          "m.description",
          "m.material_level_id",
          "m.code",
          "m.hierarchy_code",
          "m.unit_of_consumption_id",
          "m.unit_of_distribution_id",
          "m.consumption_unit_per_distribution_unit",
          "m.is_temperature_sensitive",
          "m.min_retail_price",
          "m.max_retail_price",
          "m.min_temperature",
          "m.max_temperature",
          "m.material_type_id",
          "m.material_subtype_id",
          "m.is_managed_in_batch",
          "m.is_stock_opname_mandatory",
          "m.status",
          "m.created_by",
          "m.updated_by",
          "m.deleted_by",
          "m.created_at",
          "m.updated_at",
          "m.deleted_at",
          sql`ia.metadata`.as("external_properties"),
          sql`ia.client_id`.as("integration_client_id"),
        ])
        .groupBy("m.id")
        .execute(),
      query
        .select((eb) => eb.fn.count("m.id").distinct().as("total"))
        .executeTakeFirstOrThrow(),
    ])

    return {
      data: list,
      total: Number(count.total),
    }
  }

  private initializeQuery(c: Context) {
    return c.var.trx
      .selectFrom("materials as m")
      .leftJoin("material_workspaces as mw", "mw.material_id", "m.id")
      .leftJoin("integration_associations as ia", (join) =>
        join
          .onRef("ia.internal_id", "=", "m.id")
          .on("ia.type", "=", sql`'material'`)
      )
      .where("m.deleted_at", "is", null)
      .where("mw.deleted_at", "is", null)
      .$if(!!c.var.client, (qb) =>
        qb.where("ia.client_id", "=", c.var.client!.getId())
      )
  }

  private applyFilters(query, queryParam: GetMaterialsQueryParams) {
    if (queryParam.keyword) {
      query = query.where((eb) =>
        eb.or([
          eb("m.name", "like", `%${queryParam.keyword}%`),
          eb("m.code", "like", `%${queryParam.keyword}%`),
          eb("m.hierarchy_code", "like", `%${queryParam.keyword}%`),
        ])
      )
    }

    if (queryParam.is_hierarchy !== undefined) {
      query = query
        .innerJoin("workspaces as w", "w.id", "mw.workspace_id")
        .where(
          sql`JSON_EXTRACT(w.config, '$.material.is_hierarchy_enabled')`,
          "=",
          sql`${queryParam.is_hierarchy === 1}`
        )
    }

    if (queryParam.program_ids && queryParam.program_ids.length > 0) {
      const programIds = queryParam.program_ids
      const includeNoRelation = programIds.includes(0)
      const validIds = programIds.filter((id) => id !== 0)

      query = query.where((eb) => {
        if (validIds.length > 0 && includeNoRelation) {
          return eb.or([
            eb("mw.material_id", "is", null),
            eb("mw.workspace_id", "in", validIds),
          ])
        }

        if (includeNoRelation) {
          return eb("mw.material_id", "is", null)
        }

        if (validIds.length > 0) {
          return eb("mw.workspace_id", "in", validIds)
        }

        return eb.or([])
      })
    }

    if (
      queryParam.material_level_ids &&
      queryParam.material_level_ids.length > 0
    ) {
      query = query.where(
        "m.material_level_id",
        "in",
        queryParam.material_level_ids
      )
    }

    if (
      queryParam.material_type_ids &&
      queryParam.material_type_ids.length > 0
    ) {
      query = query.where(
        "m.material_type_id",
        "in",
        queryParam.material_type_ids
      )
    }

    return query
  }

  private applySorting(query, queryParam: GetMaterialsQueryParams) {
    const sortMapping = {
      name: "m.name",
      material_type: "mt.name",
      material_level: "ml.name",
      managed_in_batch: "m.is_managed_in_batch",
      updated_by: "u.firstname",
      created_at: "m.created_at",
    }

    if (queryParam.sort_by && sortMapping[queryParam.sort_by]) {
      if (queryParam.sort_by === "material_type") {
        query = query.innerJoin(
          "material_types as mt",
          "mt.id",
          "m.material_type_id"
        )
      } else if (queryParam.sort_by === "material_level") {
        query = query.innerJoin(
          "material_levels as ml",
          "ml.id",
          "m.material_level_id"
        )
      } else if (queryParam.sort_by === "updated_by") {
        query = query.innerJoin("users as u", "u.id", "m.updated_by")
      }

      query = query.orderBy(
        sortMapping[queryParam.sort_by],
        queryParam.sort_type ?? "asc"
      )
    }

    return query
  }

  async findById(c: Context, id: number, integrationClientID?: number) {
    const result = await c.var.trx
      .selectFrom("materials as m")
      .leftJoin("integration_associations as ia", (join) =>
        join
          .onRef("ia.internal_id", "=", "m.id")
          .on("ia.type", "=", sql`'material'`)
      )
      .where("m.id", "=", id)
      .$if(!!integrationClientID, (qb) =>
        qb.where("ia.client_id", "=", integrationClientID!)
      )
      .selectAll("m")
      .select([
        "ia.metadata as external_properties",
        "ia.client_id as integration_client_id",
      ])
      .executeTakeFirst()

    return result
  }

  async updateStatus(c: Context, ids: number[], status: number) {
    const result = await c.var.trx
      .updateTable("materials")
      .set({
        status: status,
        updated_by: c.var.accountID,
      })
      .where("id", "in", ids)
      .executeTakeFirst()

    return result
  }

  async findDynamic<T>(
    c: Context,
    field: ReferenceExpression<DB, "materials">,
    operator: ComparisonOperatorExpression,
    value: T
  ) {
    const result = await c.var.trx
      .selectFrom("materials")
      .where(field, operator, value)
      .where("deleted_at", "is", null)
      .selectAll()
      .execute()

    return result
  }

  async findDynamicMultiField<T>(
    c: Context,
    fields: ReferenceExpression<DB, "materials">[],
    operator: ComparisonOperatorExpression,
    value: T
  ) {
    const result = await c.var.trx
      .selectFrom("materials")
      .where((eb) => {
        return eb.or(fields.map((field) => eb(field, operator, value)))
      })
      .where("deleted_at", "is", null)
      .selectAll()
      .execute()

    return result
  }

  async findInWorkspace(c: Context, id: number) {
    const records = await c.var.trx
      .selectFrom("ws_materials")
      .where("global_id", "=", id)
      .selectAll()
      .execute()

    return records
  }

  // check if material is already placed on stock, which means that the material is already transacted
  async findInTransaction(c: Context, id: number) {
    return await c.var.trx
      .selectFrom("ws_materials as wm")
      .innerJoin("ws_stocks as ws", "ws.material_id", "wm.id")
      .where("global_id", "=", id)
      .where("ws.deleted_at", "is", null)
      .select([
        "wm.consumption_unit_per_distribution_unit",
        "wm.is_managed_in_batch",
        "wm.is_temperature_sensitive",
      ])
      .limit(1)
      .executeTakeFirst()
  }

  // check if material is already used in stock opname operations
  async findInStockOpname(c: Context, id: number) {
    return await c.var.trx
      .selectFrom("ws_materials as wm")
      .innerJoin("ws_stock_opnames as wso", "wso.material_id", "wm.id")
      .where("global_id", "=", id)
      .where("wso.deleted_at", "is", null)
      .select("wm.is_stock_opname_mandatory")
      .limit(1)
      .executeTakeFirst()
  }
}
