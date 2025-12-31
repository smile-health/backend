import { Context } from "hono"
import { BaseRepository } from "../base.repository.js"
import { GetListGroupTargetQueries } from "./annual-planning-group-target.schema.js"

export class AnnualPlanningGroupTargetRepository extends BaseRepository<"target_groups"> {
  constructor() {
    super("target_groups")
  }

  async existsByTitle(c: Context, title: string): Promise<number | null> {
    const row = await c.var.trx
      .selectFrom(this.tableName)
      .select(["id"])
      .where("deleted_at", "is", null)
      .where("is_active", "=", 1)
      .where("title", "=", title)
      .executeTakeFirst()

    return row?.id ?? null
  }

  async getListGroupTarget(c: Context, params: GetListGroupTargetQueries) {
    const { page, paginate, keyword } = params
    const offset = (page - 1) * paginate

    let query = c.var.trx
      .selectFrom(`${this.tableName} as tg`)
      .leftJoin("users as u_created", "u_created.id", "tg.created_by")
      .leftJoin("users as u_updated", "u_updated.id", "tg.updated_by")
      .where("tg.deleted_at", "is", null)

    if (keyword) {
      query = query.where("tg.title", "like", `%${keyword}%`)
    }

    const [list, totalList] = await Promise.all([
      query
        .select([
          "tg.id",
          "tg.title",
          "tg.is_active",
          "tg.created_at",
          "tg.updated_at",
          "tg.age_min",
          "tg.age_max",
          "u_created.id as id_created",
          "u_created.username as username_created",
          "u_created.firstname as firstname_created",
          "u_created.lastname as lastname_created",
          "u_updated.id as id_updated",
          "u_updated.username as username_updated",
          "u_updated.firstname as firstname_updated",
          "u_updated.lastname as lastname_updated",
        ])
        .limit(paginate)
        .offset(offset)
        .orderBy("tg.updated_at", "desc")
        .execute(),
      query.select((eb) => eb.fn.countAll().as("total")).executeTakeFirst(),
    ])

    return {
      list,
      total: Number(totalList?.total) || 0,
    }
  }

  async getActiveTargetGroups(c: Context) {
    const rows = await c.var.trx
      .selectFrom(this.tableName)
      .select(["id", "title"])
      .where("deleted_at", "is", null)
      .where("is_active", "=", 1)
      .orderBy("id")
      .execute()

    return rows.map((r) => ({ id: Number(r.id), title: String(r.title) }))
  }

  async getListGroupTargetStream(
    c: Context,
    params: GetListGroupTargetQueries
  ) {
    let query = c.var.trx
      .selectFrom(this.tableName)
      .where("deleted_at", "is", null)

    if (params?.keyword) {
      query = query.where("title", "like", `%${params.keyword}%`)
    }

    return query
      .select(["id", "title", "is_active", "age_min", "age_max"])
      .stream()
  }
}
