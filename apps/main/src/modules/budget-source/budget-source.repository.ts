import { WsBudgetSources } from "@/common/infrastructure/database/types/db.js"
import { Context } from "hono"
import { OrderByDirectionExpression } from "kysely"
import { BaseRepository } from "../base.repository.js"
import { GetBudgetSourceQueries } from "./budget-source.schema.js"

export class BudgetSourceRepository extends BaseRepository<"ws_budget_sources"> {
  constructor() {
    super("ws_budget_sources")
  }

  async findAll(
    c: Context,
    queries: GetBudgetSourceQueries,
    sortBy: string | undefined | null = "updated_at",
    sortType: string | undefined | null = "desc"
  ) {
    let query = c.var.trx
      .selectFrom("ws_budget_sources as wbs")
      .where("wbs.program_id", "=", c.var.programId)
      .$if(sortBy === "user_updated_by", (eb) =>
        eb
          .leftJoin("users as us", "us.id", "wbs.updated_by")
          .orderBy("us.firstname", sortType as OrderByDirectionExpression)
      )

    if (queries.keyword) {
      query = query.where("wbs.name", "like", `%${queries.keyword}%`)
    }

    if (queries.status !== undefined && queries.status !== null) {
      query = query.where("wbs.status", "=", queries.status)
    }

    if (queries.is_restricted !== undefined && queries.is_restricted !== null) {
      query = query.where("wbs.is_restricted", "=", queries.is_restricted)
    }

    if (sortBy && sortBy !== "user_updated_by") {
      query = query.orderBy(
        `wbs.${sortBy as keyof WsBudgetSources}`,
        sortType as OrderByDirectionExpression
      )
    } else if (!sortBy) {
      query = query.orderBy("wbs.updated_at", "desc")
    }

    query = query.where("wbs.deleted_at", "is", null)

    const queryAll = queries.isPaginate
      ? query
          .limit(queries.paginate)
          .offset(queries.offset)
          .selectAll("wbs")
          .execute()
      : query.selectAll().execute()

    const [budgetSources, count] = await Promise.all([
      queryAll,
      query
        .select((fn) => fn.fn.countAll().as("total"))
        .executeTakeFirstOrThrow(),
    ])

    return {
      budgetSources,
      total: Number(count?.total ?? 0),
    }
  }

  async updateStatus(c: Context, budgetSourceId: number, status: number) {
    return await c.var.trx
      .updateTable("budget_source_workspaces")
      .set({
        status: status,
      })
      .where("id", "=", budgetSourceId)
      .executeTakeFirst()
  }
}
