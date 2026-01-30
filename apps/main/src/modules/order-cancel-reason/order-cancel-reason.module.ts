import { PaginatedResponse } from "@smile-health/lib/types/paginate.js"
import { Context } from "hono"
import { OrderCancelReasonRepository } from "./order-cancel-reason.repository.js"
import { GetOrderReasonsQueryParam } from "./order-cancel-reason.schema.js"

export class OrderCancelReasonModule {
  constructor(
    private readonly orderCancelReasonRepo: OrderCancelReasonRepository
  ) {}

  async list(c: Context, param: GetOrderReasonsQueryParam) {
    const [listOrderCancelReason, totalOrderCancelReason] = await Promise.all([
      this.orderCancelReasonRepo.getListOrderCancelReason(c, param),
      this.orderCancelReasonRepo.getTotalCountOrderCancelReason(c, param),
    ])

    const translatedOrderReasons = listOrderCancelReason.map(
      (orderCancelReason) => {
        return {
          ...orderCancelReason,
          name: c.var.t(`order_cancel_reason.label.${orderCancelReason.name}`),
        }
      }
    )

    return new PaginatedResponse(
      param,
      translatedOrderReasons,
      totalOrderCancelReason
    )
  }
}
