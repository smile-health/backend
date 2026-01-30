import { PaginatedResponse } from "@smile-health/lib/types/paginate.js"
import { Context } from "hono"
import { OrderReasonRepository } from "./order-reason.repository.js"
import { GetOrderReasonsQueryParam } from "./order-reason.schema.js"

export class OrderReasonModule {
  constructor(private readonly orderReasonRepo: OrderReasonRepository) {}

  async list(c: Context, param: GetOrderReasonsQueryParam) {
    const [listOrderReason, totalOrderReason] = await Promise.all([
      this.orderReasonRepo.getListOrderReason(c, param),
      this.orderReasonRepo.getTotalCountOrderReason(c, param),
    ])

    const translatedOrderReasons = listOrderReason.map((orderReason) => {
      return {
        ...orderReason,
        name: c.var.t(`order_reason.label.${orderReason.name}`),
      }
    })

    return new PaginatedResponse(
      param,
      translatedOrderReasons,
      totalOrderReason
    )
  }
}
