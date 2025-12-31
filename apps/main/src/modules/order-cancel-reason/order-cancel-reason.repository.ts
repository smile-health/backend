import { DB } from "@/common/infrastructure/database/types/db.js"
import { Context } from "@smile/lib/types/context.js"
import { GetOrderReasonsQueryParam } from "./order-cancel-reason.schema.js"
import { BaseRepository } from "../base.repository.js"

export class OrderCancelReasonRepository extends BaseRepository<"ws_order_cancel_reasons"> {
  constructor(filterProgram = false, filterActivity = false) {
    super("ws_order_cancel_reasons", filterProgram, filterActivity)
  }

  async getListOrderCancelReason(
    c: Context<DB>,
    param: GetOrderReasonsQueryParam
  ) {
    const { page, paginate, keyword } = param
    const offset = (page - 1) * paginate
    let query = c.var.trx.selectFrom("ws_order_cancel_reasons")

    if (keyword) {
      query = query.where("name", "like", `%${keyword}%`)
    }

    const listOrderCancelReason = await query
      .select(["id", "name"])
      .orderBy("id")
      .limit(paginate)
      .offset(offset)
      .execute()

    return listOrderCancelReason
  }

  async getTotalCountOrderCancelReason(
    c: Context<DB>,
    param: GetOrderReasonsQueryParam
  ) {
    const { keyword } = param

    let query = c.var.trx.selectFrom("ws_order_cancel_reasons")

    if (keyword) {
      query = query.where("name", "like", `%${keyword}%`)
    }

    const totalOrderCancelReason = await query
      .select((eb) => eb.fn.countAll().as("total"))
      .executeTakeFirst()

    return Number(totalOrderCancelReason?.total) || 0
  }
}
