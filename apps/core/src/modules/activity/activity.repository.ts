import { Context } from "hono"
import { BaseRepository } from "../base.repository.js"
import { flattenToNestedObject } from "@smile-health/lib/utils.js"
import { WsActivities } from "@/common/infrastructure/database/types/db.js"
import { OrderByDirectionExpression } from "kysely"
import { GetActivityQuery } from "./activity.schema.js"

export class ActivityRepository extends BaseRepository<"ws_activities"> {
  constructor() {
    super("ws_activities")
  }

  async findAllWithoutPaginate(c: Context, programId?: number) {
    let query = c.var.trx
      .selectFrom("ws_activities as wsa")
      .leftJoin("workspaces as ws", "ws.id", "wsa.program_id")
      .leftJoin("users as wuc", "wuc.id", "wsa.created_by")
      .leftJoin("users as wup", "wup.id", "wsa.updated_by")

    if (programId) {
      query = query.where("wsa.program_id", "=", programId)
    }

    const activities = await query
      .selectAll("wsa")
      .select([
        "ws.name as program_name",
        "wuc.id as user_created_by.id",
        "wuc.firstname as user_created_by.firstname",
        "wuc.lastname as user_created_by.lastname",
        "wuc.username as user_created_by.username",
        "wup.id as user_updated_by.id",
        "wup.firstname as user_updated_by.firstname",
        "wup.lastname as user_updated_by.lastname",
        "wup.username as user_updated_by.username",
      ])
      .where("wsa.deleted_at", "is", null)
      .orderBy("wsa.updated_at desc")
      .execute()

    return flattenToNestedObject(activities)
  }

  async findAllForExport(
    c: Context,
    params: GetActivityQuery,
    programId: number
  ) {
    return c.var.trx
      .selectFrom("ws_activities")
      .selectAll()
      .$if(!!params.keyword, (qb) =>
        qb.where("name", "like", `%${params.keyword}%`)
      )
      .where("deleted_at", "is", null)
      .where("program_id", "=", programId)
      .orderBy("updated_at desc")
      .execute()
  }

  async findAll(
    c: Context,
    params: GetActivityQuery,
    programId: number,
    sortBy: string | undefined | null = "updated_at",
    sortType: string | undefined | null = "desc"
  ) {
    let query = c.var.trx.selectFrom("ws_activities").orderBy("status", "desc")

    if (params.keyword)
      query = query.where("name", "like", `%${params.keyword}%`)
    if (sortBy)
      query = query.orderBy(
        sortBy as keyof WsActivities,
        sortType as OrderByDirectionExpression
      )

    const offset = (params.page - 1) * params.paginate
    const [activities, count] = await Promise.all([
      query
        .limit(params.paginate)
        .offset(offset)
        .selectAll()
        .where("deleted_at", "is", null)
        .where("program_id", "=", programId)
        .execute(),
      query
        .select((fn) => fn.fn.countAll().as("total"))
        .where("deleted_at", "is", null)
        .where("program_id", "=", programId)
        .executeTakeFirstOrThrow(),
    ])

    return {
      data: activities,
      total: Number(count.total),
    }
  }

  async findById(c: Context, id: number, programId: number) {
    return await c.var.trx
      .selectFrom("ws_activities")
      .selectAll()
      .where("id", "=", id)
      .where("program_id", "=", programId)
      .where("deleted_at", "is", null)
      .executeTakeFirst()
  }

  async findByName(c: Context, name: string, programId: number) {
    return await c.var.trx
      .selectFrom("ws_activities")
      .selectAll()
      .where("name", "=", name)
      .where("deleted_at", "is", null)
      .where("program_id", "=", programId)
      .executeTakeFirst()
  }

  async findStockGreaterThanZeroByActivityId(c: Context, activityId: number) {
    return await c.var.trx
      .selectFrom("ws_stocks")
      .selectAll()
      .where("deleted_at", "is", null)
      .where("qty", ">", 0)
      .where("activity_id", "=", activityId)
      .executeTakeFirst()
  }

  async findTransactionByActivityId(c: Context, activityId: number) {
    return await c.var.trx
      .selectFrom("ws_transactions")
      .selectAll()
      .where("activity_id", "=", activityId)
      .where("deleted_at", "is", null)
      .executeTakeFirst()
  }

  async findOrderByActivityId(c: Context, activityId: number) {
    return await c.var.trx
      .selectFrom("ws_orders")
      .selectAll()
      .where("activity_id", "=", activityId)
      .where("deleted_at", "is", null)
      .executeTakeFirst()
  }
}
