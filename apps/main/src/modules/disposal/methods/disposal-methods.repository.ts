import { GetDisposalMethodsQueryParam } from "./disposal-methods.schema.js"
import { BaseRepository } from "../../base.repository.js"
import { Context } from "hono"

export class DisposalMethodsRepository extends BaseRepository<"ws_disposal_methods"> {
  constructor(filterProgram = false, filterActivity = false) {
    super("ws_disposal_methods", filterProgram, filterActivity)
  }

  async getListDisposalMethods(
    c: Context,
    param: GetDisposalMethodsQueryParam
  ) {
    const { page, paginate, keyword } = param
    const offset = (page - 1) * paginate
    let query = c.var.trx
      .selectFrom("ws_disposal_methods")
      .where("status", "=", 1)

    if (keyword) {
      query = query.where("title", "like", `%${keyword}%`)
    }

    const listDisposalMethods = await query
      .select(["id", "title"])
      .orderBy("id")
      .limit(paginate)
      .offset(offset)
      .execute()

    return listDisposalMethods
  }

  async getTotalCountDisposalMethods(
    c: Context,
    param: GetDisposalMethodsQueryParam
  ) {
    const { keyword } = param

    let query = c.var.trx
      .selectFrom("ws_disposal_methods")
      .where("status", "=", 1)

    if (keyword) {
      query = query.where("title", "like", `%${keyword}%`)
    }

    const totalDisposalMethods = await query
      .select((eb) => eb.fn.countAll().as("total"))
      .executeTakeFirst()

    return Number(totalDisposalMethods?.total) || 0
  }
}
