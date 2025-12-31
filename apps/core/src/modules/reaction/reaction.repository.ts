import { Context } from "hono"
import { SelectQueryBuilder } from "kysely"
import { DB } from "../../common/infrastructure/database/types/db.js"
import { BaseRepository } from "../base.repository.js"
import {
  ReactionPaginatedRequestDTO,
  ReactionSelectedColumns,
} from "./reaction.schema.js"

export class ReactionRepository extends BaseRepository<"reactions"> {
  constructor() {
    super("reactions")
  }

  selectedColumns = ["reactions.id", "reactions.title"] as const

  private applyFilters<
    T extends SelectQueryBuilder<DB, "reactions", ReactionSelectedColumns>,
  >(query: T, params: ReactionPaginatedRequestDTO): T {
    if (params.keyword) {
      query = query.where("reactions.title", "like", `%${params.keyword}%`) as T
    }

    return query
  }

  async findAll(c: Context, params: ReactionPaginatedRequestDTO) {
    let query = c.var.trx
      .selectFrom("reactions")
      .where("reactions.deleted_at", "is", null)
      .select(this.selectedColumns)

    query = this.applyFilters(query, params)

    if (params.paginate && params.page) {
      const offset = (params.page - 1) * params.paginate
      query = query.limit(params.paginate).offset(offset)
    }

    const [data, count] = await Promise.all([
      query.execute(),
      query
        .clearSelect()
        .clearOrderBy()
        .select(c.var.trx.fn.count("reactions.id").as("total"))
        .executeTakeFirstOrThrow(),
    ])

    return {
      data: data,
      total: Number(count?.total ?? 0),
    }
  }
}
