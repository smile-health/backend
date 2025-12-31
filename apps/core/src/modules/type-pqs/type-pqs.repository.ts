import { Context } from "hono"
import { BaseRepository } from "../base.repository"
import { GetTypePQsQueryParams } from "./type-pqs.schema"

export class TypePQsepository extends BaseRepository<"pqs_types"> {
  constructor() {
    super("pqs_types")
  }

  async findAll(c: Context, params: GetTypePQsQueryParams) {
    let query = c.var.trx.selectFrom("pqs_types").select(["id", "name"])

    if (params.keyword) {
      query = query.where("name", "like", `%${params.keyword}%`)
    }

    const offset = (params.page - 1) * params.paginate
    const isPaginate = !!params.page && !!params.paginate

    const [list, count] = await Promise.all([
      query
        .$if(isPaginate, (qb) => qb.limit(params.paginate).offset(offset))
        .execute(),
      query
        .select((fn) => fn.fn.countAll().as("total"))
        .executeTakeFirstOrThrow(),
    ])

    return { data: list, total: Number(count.total) }
  }
}
