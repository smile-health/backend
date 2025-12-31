import { ORDER_STATUS } from "@/common/constants/order.js"
import { Context } from "hono"
import { OrderStatusConfirmRepository } from "./order-status-confirm.repository.js"
import {
  AddOrderCommentConfirmDTO,
  AddOrderHistoryConfirmDTO,
  ChangeOrderItemStockConfirmRequest,
  ChangeOrderStatusConfirmDTO,
  ChangeOrderStatusConfirmRequest,
  UpdateOrderAuditConfrimDTO,
} from "./order-status-confirm.schema.js"
import { OrderStatusConfirmPublisher } from "./order-status-confirm.publisher.js"

export class OrderStatusConfirmModule {
  constructor(
    private readonly repository: OrderStatusConfirmRepository,
    private readonly publisher: OrderStatusConfirmPublisher
  ) {}


  async update(
    c: Context,
    orderId: number,
    body: ChangeOrderStatusConfirmRequest
  ) {
    const { order_items, comment } = body
    const userId = Number(c.var.userId)
    const promises: any[] = []

    const orderItemsData: ChangeOrderItemStockConfirmRequest[] =
      order_items.map((orderItem) => ({
        ...orderItem,
        qty: orderItem.confirmed_qty,
        updated_by: userId,
        updated_at: new Date(),
      }))

    for (const orderItem of orderItemsData) {
      const { id, children, ...orderItemData } = orderItem

      if (children && children.length > 0) {
        for (const child of children) {
          const { id, ...childData } = child
          const newChildData = {
            qty: childData.confirmed_qty,
            updated_by: userId,
            updated_at: new Date(),
            ...childData,
          }
          promises.push(
            this.repository.updateOrderItemStockConfirmByOrderItemId(
              c,
              id,
              newChildData
            )
          )
        }
      }

      promises.push(
        this.repository.updateOrderItemStockConfirmByOrderItemId(
          c,
          id,
          orderItemData
        )
      )
    }

    const orderData: ChangeOrderStatusConfirmDTO = {
      order_status_id: ORDER_STATUS.CONFIRMED,
      updated_by: userId,
      updated_at: new Date(),
    }

    const orderHistoryData: AddOrderHistoryConfirmDTO = {
      order_id: orderId,
      order_status_id: ORDER_STATUS.CONFIRMED,
      created_by: userId,
      updated_by: userId,
      created_at: new Date(),
      updated_at: new Date(),
    }

    const orderAuditData: UpdateOrderAuditConfrimDTO = {
      confirmed_at: new Date(),
      updated_at: new Date(),
      confirmed_by: userId,
      updated_by: userId,
    }

    promises.push(this.repository.update(c, orderData, { id: orderId }))

    promises.push(
      this.repository.createOrderHistoryConfirm(c, orderHistoryData)
    )

    promises.push(
      this.repository.updateOrderAuditConfirmByOrderId(
        c,
        orderId,
        orderAuditData
      )
    )

    if (comment) {
      const orderCommentData: AddOrderCommentConfirmDTO = {
        order_id: orderId,
        user_id: userId,
        order_status_id: ORDER_STATUS.CONFIRMED,
        created_by: userId,
        updated_by: userId,
        created_at: new Date(),
        updated_at: new Date(),
        comment: comment,
      }
      promises.push(
        this.repository.createOrderCommentConfirm(c, orderCommentData)
      )
    }

    await Promise.all(promises)

    await this.publisher.processUpdate(c, {
      order_id: orderId,
      program_id: c.get("programId"),
    })
  }
}
