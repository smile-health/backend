import { Context } from "hono"
import { SelectQueryBuilder } from "kysely"
import { DB } from "../../common/infrastructure/database/types/db.js"
import { BaseRepository } from "../base.repository.js"
import {
  ReligionPaginatedRequestDTO,
  ReligionSelectedColumns,
} from "./religion.schema.js"

export class ReligionRepository extends BaseRepository<"religions"> {
  constructor() {
    super("religions")
  }

  selectedColumns = ["religions.id", "religions.title"] as const

  private applyFilters<
    T extends SelectQueryBuilder<DB, "religions", ReligionSelectedColumns>,
  >(query: T, params: ReligionPaginatedRequestDTO): T {
    if (params.keyword) {
      query = query.where("religions.title", "like", `%${params.keyword}%`) as T
    }

    return query
  }

  async findAll(c: Context, params: ReligionPaginatedRequestDTO) {
    let query = c.var.trx
      .selectFrom("religions")
      .where("religions.deleted_at", "is", null)
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
        .select(c.var.trx.fn.count("religions.id").as("total"))
        .executeTakeFirstOrThrow(),
    ])

    return {
      data: data,
      total: Number(count?.total ?? 0),
    }
  }

  async getReligions(c: Context) {
    return c.var.trx
      .selectFrom("religions")
      .selectAll()
      .where("deleted_at", "is", null)
      .execute()
  }
}
