import { Context } from "hono"
import { BaseRepository } from "../base.repository.js"
import { GetListGroupTargetQueries } from "./annual-planning-group-target.schema.js"

export class AnnualPlanningGroupTargetRepository extends BaseRepository<"ws_plan_target_group"> {
  constructor() {
    super("ws_plan_target_group", false)
  }

  async getListTargetGroup(c: Context, params: GetListGroupTargetQueries) {
    const { page, paginate, keyword } = params
    const offset = (page - 1) * paginate

    let query = c.var.trx
      .selectFrom("target_groups")
      .where("is_active", "=", 1)
      .where("deleted_at", "is", null)

    if (keyword) {
      query = query.where("title", "like", `%${keyword}%`)
    }

    const list = await query
      .select(["id", "title"])
      .limit(paginate)
      .offset(offset)
      .execute()

    return list
  }

  async getListPlanTargetGroup(c: Context, id: number, params) {
    const { page, paginate, keyword } = params
    const offset = (page - 1) * paginate

    let query = c.var.trx
      .selectFrom(`${this.tableName} as wsptg`)
      .innerJoin("target_groups as tg", (join) =>
        join
          .onRef("wsptg.target_group_id", "=", "tg.id")
          .on("tg.deleted_at", "is", null)
          .on("tg.is_active", "=", 1)
      )
      .leftJoin("ws_users as wsu_created", "wsu_created.id", "wsptg.created_by")
      .leftJoin("ws_users as wsu_updated", "wsu_updated.id", "wsptg.updated_by")
      .where("tg.deleted_at", "is", null)
      .where("wsptg.program_plan_id", "=", id)
      .where("wsptg.deleted_at", "is", null)

    if (keyword) {
      query = query.where("tg.title", "like", `%${keyword}%`)
    }

    const [list, totalList] = await Promise.all([
      query
        .select([
          "tg.id",
          "tg.title",
          "wsptg.created_at",
          "wsptg.updated_at",
          "wsu_created.id as id_created",
          "wsu_created.username as username_created",
          "wsu_created.firstname as firstname_created",
          "wsu_created.lastname as lastname_created",
          "wsu_updated.id as id_updated",
          "wsu_updated.username as username_updated",
          "wsu_updated.firstname as firstname_updated",
          "wsu_updated.lastname as lastname_updated",
        ])
        .limit(paginate)
        .offset(offset)
        .orderBy("wsptg.updated_at", "desc")
        .execute(),
      query.select((eb) => eb.fn.countAll().as("total")).executeTakeFirst(),
    ])

    return {
      list,
      total: Number(totalList?.total) || 0,
    }
  }

  async validateListTargetGroup(c: Context, params: number[]) {
    return c.var.trx
      .selectFrom("target_groups")
      .where("id", "in", params)
      .select(["id"])
      .execute()
  }
}
