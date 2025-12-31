import { Context } from "hono"
import { SelectQueryBuilder } from "kysely"
import { DB } from "../../common/infrastructure/database/types/db.js"
import { BaseRepository } from "../base.repository.js"
import {
  OccupationPaginatedRequestDTO,
  OccupationSelectedColumns,
} from "./occupation.schema.js"

export class OccupationRepository extends BaseRepository<"occupations"> {
  constructor() {
    super("occupations")
  }

  selectedColumns = ["occupations.id", "occupations.title"] as const

  private applyFilters<
    T extends SelectQueryBuilder<DB, "occupations", OccupationSelectedColumns>,
  >(query: T, params: OccupationPaginatedRequestDTO): T {
    if (params.keyword) {
      query = query.where(
        "occupations.title",
        "like",
        `%${params.keyword}%`
      ) as T
    }

    return query
  }

  async findAll(c: Context, params: OccupationPaginatedRequestDTO) {
    let query = c.var.trx
      .selectFrom("occupations")
      .where("occupations.deleted_at", "is", null)
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
        .select(c.var.trx.fn.count("occupations.id").as("total"))
        .executeTakeFirstOrThrow(),
    ])

    return {
      data: data,
      total: Number(count?.total ?? 0),
    }
  }

  async getOccupations(c: Context) {
    return c.var.trx
      .selectFrom("occupations")
      .selectAll()
      .where("deleted_at", "is", null)
      .execute()
  }
}
