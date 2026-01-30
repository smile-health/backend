import { Workspaces } from "@/common/infrastructure/database/types/db.js"
import { convertToBoolean, flattenToNestedObject } from "@smile-health/lib/utils.js"
import { Context } from "hono"
import { OrderByDirectionExpression, sql } from "kysely"
import { BaseRepository } from "../base.repository.js"
import { ProgramParams } from "./program.schema.js"

export class ProgramRepository extends BaseRepository<"workspaces"> {
  constructor() {
    super("workspaces")
  }

  readonly #baseQueryFindAll = (c: Context, params) => {
    const { client, trx } = c.var
    const {
      keyword,
      sort_by,
      sort_type,
      is_hierarchy_enabled,
      is_beneficiaries,
      is_batch_enabled,
    } = params
    let query = trx
      .selectFrom("workspaces as ws")
      .leftJoin("users as wuc", "wuc.id", "ws.created_by")
      .leftJoin("users as wup", "wup.id", "ws.updated_by")
      .$if(!!keyword, (eb) =>
        eb.where((eb) =>
          eb.or([
            eb("ws.key", "like", `%${keyword}%`),
            eb("ws.name", "like", `%${keyword}%`),
          ])
        )
      )
      .$if(!!client, (qb) =>
        qb.innerJoin("integration_associations as a", (join) =>
          join
            .onRef("a.internal_id", "=", "ws.id")
            .on("a.client_id", "=", client!.getId())
            .on("a.type", "=", "program")
        )
      )
      .where("ws.deleted_at", "is", null)
      .where("ws.is_beneficiaries", "=", is_beneficiaries === "true" ? 1 : 0)

    if (!isNaN(Number(is_hierarchy_enabled))) {
      query = query.where(
        sql<boolean>`JSON_EXTRACT(ws.config, '$.material.is_hierarchy_enabled')`,
        "=",
        convertToBoolean(is_hierarchy_enabled)
      )
    }

    if (!isNaN(Number(is_batch_enabled))) {
      query = query.where(
        sql<boolean>`JSON_EXTRACT(ws.config, '$.material.is_batch_enabled')`,
        "=",
        convertToBoolean(is_batch_enabled)
      )
    }

    if (sort_by === "is_hierarchy_enabled") {
      query = query.orderBy(
        sql`JSON_EXTRACT(ws.config, '$.material.is_hierarchy_enabled')`,
        sort_type as OrderByDirectionExpression
      )
    } else if (sort_by && sort_type) {
      query = query.orderBy(
        `ws.${sort_by as keyof Workspaces}`,
        sort_type as OrderByDirectionExpression
      )
    }
    return query
  }

  async findAll(c: Context, params: ProgramParams) {
    const { paginate } = params
    const offset = (params.page - 1) * paginate
    const query = this.#baseQueryFindAll(c, params)

    const [programs, count] = await Promise.all([
      query
        .limit(paginate)
        .offset(offset)
        .select([
          "ws.id as id",
          "ws.key as key",
          "ws.name as name",
          "ws.description as description",
          "ws.config as config",
          "ws.created_at as created_at",
          "ws.updated_at as updated_at",
          "wuc.id as user_created_by.id",
          "wuc.firstname as user_created_by.firstname",
          "wuc.lastname as user_created_by.lastname",
          "wuc.username as user_created_by.username",
          "wup.id as user_updated_by.id",
          "wup.firstname as user_updated_by.firstname",
          "wup.lastname as user_updated_by.lastname",
          "wup.username as user_updated_by.username",
        ])
        .execute(),
      query
        .select((fn) => fn.fn.countAll().as("total"))
        .executeTakeFirstOrThrow(),
    ])

    return {
      total: count.total,
      data: programs,
    }
  }

  async findAllWithoutPagination(c: Context, params: ProgramParams) {
    const query = this.#baseQueryFindAll(c, params)

    const programs = await query
      .select([
        "ws.id as id",
        "ws.name as name",
        "ws.description as description",
        "ws.config as config",
        "ws.created_at as created_at",
        "ws.updated_at as updated_at",
        "wuc.id as user_created_by.id",
        "wuc.firstname as user_created_by.firstname",
        "wuc.lastname as user_created_by.lastname",
        "wuc.username as user_created_by.username",
        "wup.id as user_updated_by.id",
        "wup.firstname as user_updated_by.firstname",
        "wup.lastname as user_updated_by.lastname",
        "wup.username as user_updated_by.username",
      ])
      .execute()

    return flattenToNestedObject(programs)
  }

  async findDetail(c: Context, id: number) {
    const program = await c.var.trx
      .selectFrom("workspaces as ws")
      .leftJoin("users as wuc", "wuc.id", "ws.created_by")
      .leftJoin("users as wup", "wup.id", "ws.updated_by")
      .select([
        "ws.id as id",
        "ws.key as key",
        "ws.name as name",
        "ws.description as description",
        "ws.config as config",
        "ws.created_at as created_at",
        "ws.updated_at as updated_at",
        "wuc.id as user_created_by.id",
        "wuc.firstname as user_created_by.firstname",
        "wuc.lastname as user_created_by.lastname",
        "wuc.username as user_created_by.username",
        "wup.id as user_updated_by.id",
        "wup.firstname as user_updated_by.firstname",
        "wup.lastname as user_updated_by.lastname",
        "wup.username as user_updated_by.username",
      ])
      .where("ws.id", "=", id)
      .where("ws.deleted_at", "is", null)
      .executeTakeFirst()

    const protocols = await c.var.trx
      .selectFrom("protocols as p")
      .innerJoin("protocol_programs as pp", "pp.protocol_id", "p.id")
      .select(["p.id", "p.name", "p.is_kipi", "p.is_medical_history"])
      .where("pp.program_id", "=", id)
      .orderBy("id")
      .execute()

    return { ...program, protocols }
  }

  async updateWithConfig(
    c: Context,
    data: { name?: string; description?: string | null; config?: object },
    where: { id: number }
  ) {
    const updateData: Record<string, unknown> = {
      updated_by: c.var.accountID,
    }

    if (data.name !== undefined) {
      updateData.name = data.name
    }

    if (data.description !== undefined) {
      updateData.description = data.description
    }

    if (data.config !== undefined) {
      updateData.config = sql`JSON_MERGE_PATCH(COALESCE(config, '{}'), ${JSON.stringify(data.config)})`
    }

    return await c.var.trx
      .updateTable("workspaces")
      .set(updateData)
      .where("id", "=", where.id)
      .execute()
  }

  async updateProtocolByProgramId(
    c: Context,
    program_id: number,
    protocol_ids: number[]
  ) {
    const userId = c.var.accountID
    await c.var.trx
      .deleteFrom("protocol_programs")
      .where("program_id", "=", program_id)
      .execute()

    for (const protocol_id of protocol_ids)
      await c.var.trx
        .insertInto("protocol_programs")
        .values({
          program_id,
          protocol_id,
          created_by: userId,
          updated_by: userId,
        })
        .execute()
  }
}
