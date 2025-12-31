import { Context } from "hono"
import { SelectQueryBuilder } from "kysely"
import { DB } from "../../common/infrastructure/database/types/db.js"
import { BaseRepository } from "../base.repository.js"
import {
  EthnicPaginatedRequestDTO,
  EthnicSelectedColumns,
} from "./ethnic.schema.js"

export class EthnicRepository extends BaseRepository<"ethnics"> {
  constructor() {
    super("ethnics")
  }

  selectedColumns = ["ethnics.id", "ethnics.title"] as const

  private applyFilters<
    T extends SelectQueryBuilder<DB, "ethnics", EthnicSelectedColumns>,
  >(query: T, params: EthnicPaginatedRequestDTO): T {
    if (params.keyword) {
      query = query.where("ethnics.title", "like", `%${params.keyword}%`) as T
    }

    return query
  }

  async findAll(c: Context, params: EthnicPaginatedRequestDTO) {
    let query = c.var.trx
      .selectFrom("ethnics")
      .where("ethnics.deleted_at", "is", null)
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
        .select(c.var.trx.fn.count("ethnics.id").as("total"))
        .executeTakeFirstOrThrow(),
    ])

    return {
      data: data,
      total: Number(count?.total ?? 0),
    }
  }

  async getEthnics(c: Context) {
    return c.var.trx
      .selectFrom("ethnics")
      .selectAll()
      .where("deleted_at", "is", null)
      .execute()
  }
}
