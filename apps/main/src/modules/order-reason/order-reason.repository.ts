import { DB } from "@/common/infrastructure/database/types/db.js"
import { Context } from "@smile-health/lib/types/context.js"
import { GetOrderReasonsQueryParam } from "./order-reason.schema.js"
import { BaseRepository } from "../base.repository.js"

export class OrderReasonRepository extends BaseRepository<"ws_order_reasons"> {
  constructor(filterProgram = false, filterActivity = false) {
    super("ws_order_reasons", filterProgram, filterActivity)
  }

  async getListOrderReason(c: Context<DB>, param: GetOrderReasonsQueryParam) {
    const { page, paginate, keyword, order_type } = param
    const offset = (page - 1) * paginate
    let query = c.var.trx.selectFrom("ws_order_reasons")

    if (keyword) {
      query = query.where("name", "like", `%${keyword}%`)
    }

    if (order_type) {
      query = query.where((eb) =>
        eb.or([eb("order_type", "=", order_type), eb("order_type", "is", null)])
      )
    }

    const listOrderReason = await query
      .select(["id", "name"])
      .orderBy("id")
      .limit(paginate)
      .offset(offset)
      .execute()

    return listOrderReason
  }

  async getTotalCountOrderReason(
    c: Context<DB>,
    param: GetOrderReasonsQueryParam
  ) {
    const { keyword } = param

    let query = c.var.trx.selectFrom("ws_order_reasons")

    if (keyword) {
      query = query.where("name", "like", `%${keyword}%`)
    }

    const totalOrderReason = await query
      .select((eb) => eb.fn.countAll().as("total"))
      .executeTakeFirst()

    return Number(totalOrderReason?.total) || 0
  }
}
