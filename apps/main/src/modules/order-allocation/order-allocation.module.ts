import { DEVICE_TYPE } from "@/common/constants/device.js"
import {
  IS_ALLOCATED,
  ORDER_STATUS,
  ORDER_TYPE,
} from "@/common/constants/order.js"
import { Context } from "hono"
import { OrderAuditRepository } from "../order-audit/order-audit.repository.js"
import { CreateOrderAuditDTO } from "../order-audit/order-audit.schema.js"
import { OrderCommentRepository } from "../order-comment/order-comment.repository.js"
import { CreateOrderCommentDTO } from "../order-comment/order-comment.schema.js"
import { OrderHistoryRepository } from "../order-history/order-history.repository.js"
import { CreateOrderHistoryDTO } from "../order-history/order-history.schema.js"
import { OrderItemStockRepository } from "../order-item-stock/order-item-stock.repository.js"
import { OrderRepository } from "../order/order.repository.js"
import { CreateOrderDTO } from "../order/order.schema.js"
import { OrderAllocationRepository } from "./order-allocation.repository.js"
import {
  CreateAllocationOrderItemStockDTO,
  CreateOrderAllocationRequest,
} from "./order-allocation.schema.js"
import { OrderDroppingPublisher } from "../base.order-dropping.publisher.js"

export class OrderAllocationModule {
  constructor(
    private readonly repo: OrderRepository,
    private readonly orderCommentRepo: OrderCommentRepository,
    private readonly orderItemStockRepo: OrderItemStockRepository,
    private readonly orderAuditRepo: OrderAuditRepository,
    private readonly orderHistoryRepo: OrderHistoryRepository,
    private readonly orderAllocationRepo: OrderAllocationRepository,
    private readonly orderDroppingPublisher: OrderDroppingPublisher
  ) {}

  async create(c: Context, body: CreateOrderAllocationRequest) {
    const userId = Number(c.var.userId)
    const { order_comment, order_items, required_date } = body

    // Create Order
    const orderData: CreateOrderDTO = {
      customer_id: body.customer_id,
      vendor_id: body.vendor_id,
      taken_by_customer: body.taken_by_customer,
      order_status_id: ORDER_STATUS.ALLOCATED,
      order_type_id: ORDER_TYPE.DISTRIBUTION,
      activity_id: body.activity_id,
      is_allocated: 1,
      total_order_items: order_items.length,
      created_by: userId,
      updated_by: userId,
      device_type:
        c.var.deviceType ?? DEVICE_TYPE[c.req.header("Device-Type") ?? "web"],
    }

    const createdOrder = await this.repo.create(c, orderData)
    const createdOrderId = Number(createdOrder.insertId)

    // Create Order Audit
    const orderAuditData: CreateOrderAuditDTO = {
      order_id: createdOrderId,
      allocated_at: new Date(),
      allocated_by: userId,
      confirmed_at: new Date(),
      confirmed_by: userId,
      required_date: required_date,
    }

    // Create Order History
    const orderHistoryData: CreateOrderHistoryDTO = {
      order_id: createdOrderId,
      order_status_id: ORDER_STATUS.ALLOCATED,
      created_by: userId,
      updated_by: userId,
    }

    const promises = [
      this.orderAuditRepo.create(c, orderAuditData),
      this.orderHistoryRepo.create(c, orderHistoryData),
    ]

    // Create Order Comment
    if (order_comment) {
      const orderCommentData: CreateOrderCommentDTO = {
        order_id: createdOrderId,
        user_id: userId,
        order_status_id: ORDER_STATUS.ALLOCATED,
        comment: order_comment,
      }

      promises.unshift(this.orderCommentRepo.create(c, orderCommentData))
    }

    await Promise.all(promises)

    const orderItemsData: CreateAllocationOrderItemStockDTO[] =
      order_items.flatMap((orderItem) => {
        const totalQty = orderItem.stocks.reduce(
          (sum, stock) => sum + stock.allocated_qty,
          0
        )

        return orderItem.stocks.map((stock, index) => ({
          allocated_qty: stock.allocated_qty,
          material_id: orderItem.material_id,
          order_id: createdOrderId,
          created_by: userId,
          updated_by: userId,
          stock_id: stock.stock_id,
          order_stock_status_id: stock.order_stock_status_id,
          confirmed_qty: index === 0 ? totalQty : null,
          qty: index === 0 ? totalQty : null,
          ordered_qty: index === 0 ? totalQty : null,
        }))
      })

    // craete ws_order_item_stocks
    for (const orderItem of orderItemsData) {
      await Promise.all([
        this.orderAllocationRepo.updateStockById(
          c,
          orderItem.stock_id,
          orderItem.allocated_qty
        ),
        this.orderItemStockRepo.create(c, orderItem),
      ])
    }

    await this.orderDroppingPublisher.processCreate(c, createdOrderId, {
      ...body,
      is_allocated: IS_ALLOCATED.TRUE,
    })

    return { id: createdOrderId }
  }
}
