import { Context } from "hono"
import { SelectQueryBuilder } from "kysely"
import { DB } from "../../common/infrastructure/database/types/db.js"
import { BaseRepository } from "../base.repository.js"
import {
  EducationPaginatedRequestDTO,
  EducationSelectedColumns,
} from "./education.schema.js"

export class EducationRepository extends BaseRepository<"educations"> {
  constructor() {
    super("educations")
  }

  selectedColumns = ["educations.id", "educations.title"] as const

  private applyFilters<
    T extends SelectQueryBuilder<DB, "educations", EducationSelectedColumns>,
  >(query: T, params: EducationPaginatedRequestDTO): T {
    if (params.keyword) {
      query = query.where(
        "educations.title",
        "like",
        `%${params.keyword}%`
      ) as T
    }

    return query
  }

  async findAll(c: Context, params: EducationPaginatedRequestDTO) {
    let query = c.var.trx
      .selectFrom("educations")
      .where("educations.deleted_at", "is", null)
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
        .select(c.var.trx.fn.count("educations.id").as("total"))
        .executeTakeFirstOrThrow(),
    ])

    return {
      data: data,
      total: Number(count?.total ?? 0),
    }
  }

  async getEducations(c: Context) {
    return c.var.trx
      .selectFrom("educations")
      .selectAll()
      .where("deleted_at", "is", null)
      .execute()
  }
}
