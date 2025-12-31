import { DEVICE_TYPE } from "@/common/constants/device.js"
import {
  IS_ALLOCATED,
  ORDER_STATUS,
  ORDER_TYPE,
} from "@/common/constants/order.js"
import { Context } from "hono"
import { OrderReturnRepository } from "./order-return.repository.js"
import {
  AddOrderAuditReturnDTO,
  AddOrderCommentReturnDTO,
  AddOrderHistoryReturnDTO,
  AddOrderItemStockReturnDTO,
  AddOrderReturnDTO,
  OrderReturnRequest,
} from "./order-return.schema.js"
import { OrderDroppingPublisher } from "../base.order-dropping.publisher.js"

export class OrderReturnModule {
  constructor(
    private readonly repository: OrderReturnRepository,
    private readonly orderDroppingPublisher: OrderDroppingPublisher
  ) {}

  async create(c: Context, body: OrderReturnRequest) {
    const {
      customer_id,
      vendor_id,
      activity_id,
      required_date,
      order_comment,
      order_items,
    } = body
    const userId = Number(c.var.userId)
    const deviceType = c.req.header("device-type") ?? "web"
    const promises: unknown[] = []

    const orderData: AddOrderReturnDTO = {
      customer_id: customer_id,
      vendor_id: vendor_id,
      order_status_id: ORDER_STATUS.ALLOCATED,
      order_type_id: ORDER_TYPE.RETURN,
      activity_id: activity_id,
      device_type: DEVICE_TYPE[deviceType],
      is_allocated: IS_ALLOCATED.TRUE,
      total_order_items: order_items.length,
      created_by: userId,
      updated_by: userId,
      created_at: new Date(),
      updated_at: new Date(),
    }

    const order = await this.repository.create(c, orderData)

    promises.push(order)

    const orderHistoryData: AddOrderHistoryReturnDTO = {
      order_id: Number(order.insertId),
      order_status_id: ORDER_STATUS.ALLOCATED,
      created_by: userId,
      updated_by: userId,
      created_at: new Date(),
      updated_at: new Date(),
    }

    const orderAuditData: AddOrderAuditReturnDTO = {
      order_id: Number(order.insertId),
      confirmed_at: new Date(),
      allocated_at: new Date(),
      created_at: new Date(),
      updated_at: new Date(),
      confirmed_by: userId,
      allocated_by: userId,
      created_by: userId,
      updated_by: userId,
      required_date: required_date,
    }

    promises.push(this.repository.createOrderHistoryReturn(c, orderHistoryData))

    promises.push(this.repository.createOrderAuditReturn(c, orderAuditData))

    if (order_comment) {
      const orderCommentData: AddOrderCommentReturnDTO = {
        order_id: Number(order.insertId),
        user_id: userId,
        order_status_id: ORDER_STATUS.ALLOCATED,
        created_by: userId,
        updated_by: userId,
        created_at: new Date(),
        updated_at: new Date(),
        comment: order_comment,
      }
      promises.push(
        this.repository.createOrderCommentReturn(c, orderCommentData)
      )
    }

    const orderItemsData: AddOrderItemStockReturnDTO[] = order_items.flatMap(
      (orderItem) =>
        orderItem.stocks.map((stock) => ({
          order_id: Number(order.insertId),
          material_id: orderItem.material_id,
          stock_id: stock.stock_id,
          allocated_qty: stock.allocated_qty,
          order_stock_status_id: stock.order_stock_status_id ?? null,
          created_by: userId,
          updated_by: userId,
          created_at: new Date(),
          updated_at: new Date(),
        }))
    )

    const totalAllocatedQtyPerMaterial = orderItemsData.reduce((acc, item) => {
      if (acc[item.material_id]) {
        acc[item.material_id] += item.allocated_qty
      } else {
        acc[item.material_id] = item.allocated_qty
      }
      return acc
    }, {})

    const existMaterialId: number[] = []
    for (const orderItemData of orderItemsData) {
      if (
        !existMaterialId.includes(orderItemData.material_id) &&
        totalAllocatedQtyPerMaterial[orderItemData.material_id]
      ) {
        const totalOrderedConfirmedQty =
          totalAllocatedQtyPerMaterial[orderItemData.material_id]
        orderItemData["qty"] = totalOrderedConfirmedQty
        orderItemData["ordered_qty"] = totalOrderedConfirmedQty
        orderItemData["confirmed_qty"] = totalOrderedConfirmedQty
      }
      if (!existMaterialId.includes(orderItemData.material_id)) {
        existMaterialId.push(orderItemData.material_id)
      }
    }

    const stocksIds = orderItemsData.map(
      (orderItemData) => orderItemData.stock_id
    )

    const stocks = await this.repository.getStockByIds(c, stocksIds)

    const updatedOrderItemsStocks = orderItemsData.map((orderItemData) => {
      const updatedOrderItemStock = stocks.find(
        (stock) => stock.id === orderItemData.stock_id
      )
      return {
        ...orderItemData,
        stock_allocated_qty: updatedOrderItemStock!.allocated_qty,
      }
    })

    for (const updatedOrderItemStock of updatedOrderItemsStocks) {
      const { stock_allocated_qty, ...rest } = updatedOrderItemStock
      const itemStock = { ...rest }

      promises.push(this.repository.createOrderItemStockReturn(c, itemStock))
      promises.push(
        this.repository.updateStockReturnById(c, itemStock.stock_id, {
          allocated_qty: stock_allocated_qty
            ? stock_allocated_qty + itemStock.allocated_qty
            : itemStock.allocated_qty,
          updated_by: userId,
          updated_at: new Date(),
        })
      )
    }

    await Promise.all(promises)

    await this.orderDroppingPublisher.processCreate(c, order.insertId, {
      ...body,
      is_allocated: IS_ALLOCATED.TRUE,
    })

    return { id: Number(order.insertId) }
  }
}
