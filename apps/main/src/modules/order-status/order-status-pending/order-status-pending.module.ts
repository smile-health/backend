import { ORDER_STATUS } from "@/common/constants/order.js"
import { Context } from "hono"
import { OrderStatusPendingRepository } from "./order-status-pending.repository.js"
import {
  AddOrderHistoryPendingDTO,
  ChangeOrderItemStockPendingDTO,
  ChangeOrderStatusPendingDTO,
} from "./order-status-pending.schema.js"

export class OrderStatusPendingModule {
  constructor(private readonly repository: OrderStatusPendingRepository) {}

  async update(c: Context, orderId: number) {
    const userId = Number(c.var.userId)
    const promises: any[] = []

    const orderItemStocks = await this.repository.getOrderItemStockByOrderId(
      c,
      orderId
    )

    for (const orderItemStock of orderItemStocks) {
      const itemData: ChangeOrderItemStockPendingDTO = {
        qty: orderItemStock.ordered_qty,
        confirmed_qty: 0,
        updated_by: userId,
        updated_at: new Date(),
      }

      promises.push(
        this.repository.updateOrderItemStockPendingByOrderItemId(
          c,
          orderItemStock.id,
          itemData
        )
      )
    }

    const orderData: ChangeOrderStatusPendingDTO = {
      order_status_id: ORDER_STATUS.PENDING,
      updated_by: userId,
      updated_at: new Date(),
    }

    const orderHistoryData: AddOrderHistoryPendingDTO = {
      order_id: orderId,
      order_status_id: ORDER_STATUS.PENDING,
      created_by: userId,
      updated_by: userId,
      created_at: new Date(),
      updated_at: new Date(),
    }

    promises.push(this.repository.update(c, orderData, { id: orderId }))

    promises.push(
      this.repository.createOrderHistoryPending(c, orderHistoryData)
    )

    await Promise.all(promises)
  }
}
