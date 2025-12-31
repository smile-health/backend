import { DB } from "@/common/infrastructure/database/types/db.js"
import { Context } from "@smile/lib/types/context.js"
import { ComparisonOperatorExpression, ReferenceExpression } from "kysely"
import {
  BudgetSourceSyncRequest,
  GetBudgetSourceQueries,
} from "./budget-source.schema.js"

type TableBudgetSource = keyof Pick<DB, "source_materials">

export class BudgetSourceRepository {
  async findAll(c: Context<DB>, queries: GetBudgetSourceQueries) {
    let query = c.var.trx.selectFrom("source_materials")

    if (queries.keyword) {
      query = query
        .where("name", "like", `%${queries.keyword}%`)
        .orderBy("name asc")
    } else {
      query = query.orderBy("created_at desc")
    }

    if (queries.ids?.length! > 0) {
      query = query.where("id", "in", queries.ids!)
    }

    query = query.where("deleted_at", "is", null)

    const queryAll = queries.isPaginate
      ? query
          .limit(queries.paginate)
          .offset(queries.offset)
          .selectAll()
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

  async upsert(c: Context<DB>, body: BudgetSourceSyncRequest) {
    console.log(`body ${JSON.stringify(body)}`)
    if (body.id) {
      return await c.var.trx
        .updateTable("source_materials")
        .set(body)
        .where("id", "=", body.id)
        .execute()
    }

    return await c.var.trx.insertInto("source_materials").values(body).execute()
  }

  async findAllDynamic<T>(
    c: Context<DB>,
    whereClause: ReferenceExpression<DB, TableBudgetSource>,
    operator: ComparisonOperatorExpression,
    value: T,
    isWhere: boolean = false
  ) {
    return await c.var.trx
      .selectFrom("source_materials")
      .$if(isWhere, (eb) => eb.where(whereClause, operator, value))
      .selectAll()
      .execute()
  }

  async findOneDynamic<T>(
    c: Context<DB>,
    whereClause: ReferenceExpression<DB, TableBudgetSource>,
    operator: ComparisonOperatorExpression,
    value: T,
    isWhere: boolean = false
  ) {
    return await c.var.trx
      .selectFrom("source_materials")
      .$if(isWhere, (eb) => eb.where(whereClause, operator, value))
      .selectAll()
      .executeTakeFirst()
  }
}
