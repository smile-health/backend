import { BudgetSources } from "@/common/infrastructure/database/types/db.js"
import { Context } from "hono"
import { OrderByDirectionExpression } from "kysely"
import { BaseRepository } from "../base.repository.js"
import { GetBudgetSourceQueries } from "./budget-source.schema.js"

export class BudgetSourceRepository extends BaseRepository<"budget_sources"> {
  constructor() {
    super("budget_sources")
  }

  async findAll(
    c: Context,
    queries: GetBudgetSourceQueries,
    sortBy: string | undefined | null = "updated_at",
    sortType: string | undefined | null = "desc"
  ) {
    let query = c.var.trx
      .selectFrom("budget_sources")
      .leftJoin(
        "budget_source_workspaces",
        "budget_source_workspaces.budget_source_id",
        "budget_sources.id"
      )
      .$if(sortBy === "user_updated_by", (eb) =>
        eb
          .leftJoin("users", "users.id", "budget_sources.updated_by")
          .orderBy("users.firstname", sortType as OrderByDirectionExpression)
      )

    if (sortBy && sortBy !== "user_updated_by") {
      query = query.orderBy(
        `budget_sources.${sortBy as keyof BudgetSources}`,
        sortType as OrderByDirectionExpression
      )
    } else {
      query = query.orderBy("budget_sources.updated_at", "desc")
    }

    const conditionWhereClause = await this.#conditionWhereClause(
      query,
      queries
    )
    query = conditionWhereClause.query

    query = query.where("budget_sources.deleted_at", "is", null)

    const queryAll = queries?.isPaginate
      ? query
          .limit(queries.paginate)
          .offset(queries.offset)
          .selectAll("budget_sources")
          .groupBy("budget_sources.id")
          .execute()
      : query.selectAll("budget_sources").groupBy("budget_sources.id").execute()

    const [budgetSources, count] = await Promise.all([
      queryAll,
      query
        .select((eb) => eb.fn.count("budget_sources.id").distinct().as("total"))
        .executeTakeFirstOrThrow(),
    ])

    return {
      budgetSources,
      total: Number(count?.total ?? 0),
    }
  }

  async findInWorkspace(c: Context, id: number) {
    const records = await c.var.trx
      .selectFrom("budget_source_workspaces")
      .innerJoin(
        "budget_sources",
        "budget_sources.id",
        "budget_source_workspaces.budget_source_id"
      )
      .where("budget_source_id", "=", id)
      .select([
        "budget_source_workspaces.id as budget_source_id",
        "budget_source_workspaces.workspace_id as program_id",
      ])
      .selectAll("budget_sources")
      .execute()

    return records
  }

  async #conditionWhereClause(query: any, queries: GetBudgetSourceQueries) {
    if (queries.keyword) {
      query = query.where("name", "like", `%${queries.keyword}%`)
    }

    if (queries.ids?.length! > 0) {
      query = query.where("id", "in", queries.ids)
    }

    if (queries.program_ids && queries.program_ids.length > 0) {
      query = query.where((eb) => {
        if (
          queries?.program_ids?.includes(0) &&
          queries?.program_ids?.length === 1
        ) {
          return eb("budget_source_workspaces.workspace_id", "is", null)
        } else if (queries?.program_ids?.includes(0)) {
          return eb.or([
            eb("budget_source_workspaces.workspace_id", "is", null),
            eb(
              "budget_source_workspaces.workspace_id",
              "in",
              queries.program_ids.filter((id) => id !== 0)
            ),
          ])
        } else {
          return eb(
            "budget_source_workspaces.workspace_id",
            "in",
            queries.program_ids
          )
        }
      })
    }

    return {
      query,
    }
  }
}
