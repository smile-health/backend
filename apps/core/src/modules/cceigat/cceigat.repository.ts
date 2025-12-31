import { Context } from "hono"
import { BaseRepository } from "../base.repository"
import { GetCceigatQueryParams } from "./ccigat.schema"

export class CceigatRepository extends BaseRepository<"cceigat_descriptions"> {
  constructor() {
    super("cceigat_descriptions")
  }

  async findAll(c: Context, params: GetCceigatQueryParams) {
    let query = c.var.trx
      .selectFrom("cceigat_descriptions")
      .select(["id", "name"])

    if (params.keyword) {
      query = query.where("name", "like", `%${params.keyword}%`)
    }
    console.log(params)
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
