import { ORDER_STATUS } from "@/common/constants/order.js"
import { group } from "@smile/lib/utils.js"
import { Context } from "hono"
import { OrderStatusAllocateRepository } from "./order-status-allocate.repository.js"
import {
  AddOrderHistoryAllocateDTO,
  ChangeOrderStatusAllocateDTO,
  ChangeOrderStatusAllocateRequest,
  UpdateOrderAuditAllocateDTO,
  AddOrderCommentAllocateDTO,
} from "./order-status-allocate.schema.js"
import { OrderStatusAllocatePublisher } from "./order-status-allocate.publisher.js"

export class OrderStatusAllocateModule {
  constructor(
    private readonly repository: OrderStatusAllocateRepository,
    private readonly publisher: OrderStatusAllocatePublisher
  ) {}

  async update(
    c: Context,
    orderId: number,
    body: ChangeOrderStatusAllocateRequest
  ) {
    const { order_items, comment } = body
    const userId = Number(c.var.userId)

    const orderItemStocks = await this.repository.getOrderItemStockByOrderId(
      c,
      orderId
    )

    const promises = [
      ...this.prepareOrderData(c, orderId, userId),
      ...(await this.prepareOrderItemsData(
        c,
        order_items,
        orderItemStocks,
        userId,
        orderId
      )),
    ]

    if (comment) {
      promises.push(this.prepareOrderCommentData(c, orderId, userId, comment))
    }

    await Promise.all(promises)

    await this.publisher.processUpdate(c, {
      order_id: orderId,
      program_id: Number(c.var.programId),
    })
  }

  private prepareOrderData(c: Context, orderId: number, userId: number) {
    const orderData: ChangeOrderStatusAllocateDTO = {
      order_status_id: ORDER_STATUS.ALLOCATED,
      is_allocated: 1,
      updated_by: userId,
      updated_at: new Date(),
    }

    const orderHistoryData: AddOrderHistoryAllocateDTO = {
      order_id: orderId,
      order_status_id: ORDER_STATUS.ALLOCATED,
      created_by: userId,
      updated_by: userId,
      created_at: new Date(),
      updated_at: new Date(),
    }

    const orderAuditData: UpdateOrderAuditAllocateDTO = {
      allocated_at: new Date(),
      updated_at: new Date(),
      allocated_by: userId,
      updated_by: userId,
    }

    return [
      this.repository.update(c, orderData, { id: orderId }),
      this.repository.createOrderHistoryAllocate(c, orderHistoryData),
      this.repository.updateOrderAuditAllocateByOrderId(
        c,
        orderId,
        orderAuditData
      ),
    ]
  }

  private async prepareOrderItemsData(
    c: Context,
    order_items: any[],
    orderItemStocks: any[],
    userId: number,
    orderId: number
  ) {
    const updatedOrderItems = this.mapOrderItems(order_items, orderItemStocks)

    const orderItemsData = await this.flattenOrderItems(
      c,
      updatedOrderItems,
      userId,
      orderId
    )

    const createdChildrenOrderItemsStocks =
      this.mapNewChildrenOrderItemsStocks(orderItemsData)

    const stocks = await this.repository.getStockByIds(
      c,
      orderItemsData.map((item) => item.stock_id)
    )

    const updatedOrderItemsStocks = this.mapOrderItemsStocks(
      orderItemsData,
      stocks
    )

    const createdStockOrderItemsStocks = this.mapNewStockOrderItemsStocks(
      orderItemsData,
      stocks
    )

    const orderItemsGroup = group(updatedOrderItemsStocks, "id")

    return await this.generatePromisesForOrderItems(
      c,
      order_items,
      orderItemsGroup,
      userId,
      orderId,
      createdChildrenOrderItemsStocks,
      createdStockOrderItemsStocks
    )
  }

  private mapOrderItems(order_items: any[], orderItemStocks: any[]) {
    return order_items.map((orderItem) => {
      if (!orderItem.children || orderItem.children.length === 0) {
        const updatedOrderItem = orderItemStocks.find(
          (stock) => stock.id === orderItem.id
        )
        return {
          ...orderItem,
          material_id: updatedOrderItem?.material_id,
          order_item_kfa_id: updatedOrderItem?.order_item_kfa_id,
        }
      } else {
        const updatedChildren = orderItem.children.map((child) => {
          const updatedChild = orderItemStocks.find(
            (stock) => stock.id === child.id
          )
          return {
            ...child,
            material_id: updatedChild?.material_id ?? child.material_id,
            order_item_kfa_id:
              updatedChild?.order_item_kfa_id ?? child.order_item_kfa_id,
          }
        })
        return {
          ...orderItem,
          children: updatedChildren,
        }
      }
    })
  }

  private async flattenOrderItems(
    c: Context,
    updatedOrderItems: any[],
    userId: number,
    orderId: number
  ) {
    const result = await Promise.all(
      updatedOrderItems.map(async (updatedOrderItem) => {
        if (Array.isArray(updatedOrderItem.allocations)) {
          return updatedOrderItem.allocations.map((allocation) => ({
            id: updatedOrderItem.id,
            stock_id: allocation.stock_id,
            order_stock_status_id: allocation.order_stock_status_id || null,
            order_item_kfa_id: updatedOrderItem.order_item_kfa_id,
            material_id: updatedOrderItem.material_id,
            allocated_qty: allocation.allocated_qty,
            updated_by: userId,
            updated_at: new Date(),
          }))
        }

        if (
          Array.isArray(updatedOrderItem.children) &&
          updatedOrderItem.children.length > 0
        ) {
          const childResults = await Promise.all(
            updatedOrderItem.children.map(async (child) => {
              const results = []

              const orderItemStock = await this.repository.getItemByItemOrderId(
                c,
                updatedOrderItem.id,
                orderId
              )

              if (!child.id) {
                const baseChildData = {
                  order_item_kfa_id: child.order_item_kfa_id,
                  material_id: child.material_id,
                  recommended_stock: child.recommended_stock || null,
                  order_reason_id: child.order_reason_id || null,
                  parent_material_id: orderItemStock.material_id,
                  order_id: orderId,
                  qty: child.allocated_qty,
                  ordered_qty: child.allocated_qty,
                  confirmed_qty: child.allocated_qty,
                  created_by: userId,
                  created_at: new Date(),
                  updated_by: userId,
                  updated_at: new Date(),
                }

                results.push(baseChildData)
              }

              if (
                Array.isArray(child.allocations) &&
                child.allocations.length > 0
              ) {
                const allocationItems = child.allocations.map((allocation) => {
                  const allocationData: any = {
                    stock_id: allocation.stock_id,
                    order_stock_status_id:
                      allocation.order_stock_status_id || null,
                    allocated_qty: allocation.allocated_qty,
                    material_id: child.material_id,
                    order_item_kfa_id: child.order_item_kfa_id ?? null,
                    parent_material_id: orderItemStock.material_id,
                    updated_by: userId,
                    updated_at: new Date(),
                  }

                  if (child.id != null) {
                    allocationData.id = child.id
                  }

                  return allocationData
                })

                results.push(...allocationItems)
              }

              return results
            })
          )

          return childResults.flat()
        }

        return []
      })
    )

    return result.flat()
  }

  private mapOrderItemsStocks(orderItemsData: any[], stocks: any[]) {
    return orderItemsData
      .filter((orderItemData) => orderItemData.id !== undefined)
      .map((orderItemData) => {
        const updatedOrderItemStock = stocks.find(
          (stock) => stock.id === orderItemData.stock_id
        )
        return {
          ...orderItemData,
          stock_allocated_qty: updatedOrderItemStock!.allocated_qty,
        }
      })
  }

  private mapNewChildrenOrderItemsStocks(orderItemsData: any[]) {
    return orderItemsData
      .filter(
        (orderItemData) =>
          orderItemData.id === undefined && orderItemData.stock_id === undefined
      )
      .map((orderItemData) => {
        return {
          ...orderItemData,
        }
      })
  }

  private mapNewStockOrderItemsStocks(orderItemsData: any[], stocks: any[]) {
    return orderItemsData
      .filter(
        (orderItemData) =>
          orderItemData.id === undefined && orderItemData.stock_id !== undefined
      )
      .map((orderItemData) => {
        const createdOrderItemStock = stocks.find(
          (stock) => stock.id === orderItemData.stock_id
        )
        return {
          ...orderItemData,
          stock_allocated_qty: createdOrderItemStock!.allocated_qty,
        }
      })
  }

  private async generatePromisesForOrderItems(
    c: Context,
    order_items: any[],
    orderItemsGroup: any,
    userId: number,
    orderId: number,
    createdChildrenOrderItemsStocks: any,
    createdStockOrderItemsStocks: any
  ) {
    const promises: any[] = []

    await this.newAllocationItemStock(
      c,
      promises,
      createdChildrenOrderItemsStocks,
      createdStockOrderItemsStocks,
      userId,
      orderId
    )

    for (const orderItem of order_items) {
      if (orderItem.children && orderItem.children.length > 0) {
        for (const child of orderItem.children) {
          const groupedItems = orderItemsGroup[child.id] || []

          const totalAllocatedQty = groupedItems.reduce(
            (sum, item) => sum + (item.allocated_qty || 0),
            0
          )

          if (groupedItems.length > 1) {
            const targetIndex = groupedItems.findIndex(
              (item) => item.qty !== undefined && item.qty !== null
            )

            if (targetIndex !== -1) {
              groupedItems[targetIndex].qty = totalAllocatedQty
            }

            groupedItems.forEach((item: any, index: number) => {
              promises.push(
                ...this.handleGroupedOrderItem(c, item, index, userId, orderId)
              )
            })
          } else if (groupedItems.length === 1) {
            groupedItems[0].qty = totalAllocatedQty
            promises.push(
              ...this.handleSingleOrderItem(c, groupedItems[0], userId)
            )
          }
        }
      } else {
        const groupedItems = orderItemsGroup[orderItem.id] || []

        const totalAllocatedQty = groupedItems.reduce(
          (sum, item) => sum + (item.allocated_qty || 0),
          0
        )

        if (groupedItems.length > 1) {
          const targetIndex = groupedItems.findIndex(
            (item) => item.qty !== undefined && item.qty !== null
          )

          if (targetIndex !== -1) {
            groupedItems[targetIndex].qty = totalAllocatedQty
          }

          groupedItems.forEach((item: any, index: number) => {
            promises.push(
              ...this.handleGroupedOrderItem(c, item, index, userId, orderId)
            )
          })
        } else if (groupedItems.length === 1) {
          groupedItems[0].qty = totalAllocatedQty
          promises.push(
            ...this.handleSingleOrderItem(c, groupedItems[0], userId)
          )
        }
      }
    }

    return promises
  }

  private async newAllocationItemStock(
    c: Context,
    promises: any[],
    createdChildrenOrderItemsStocks: any,
    createdStockOrderItemsStocks: any,
    userId: number,
    orderId: number
  ) {
    if (
      createdChildrenOrderItemsStocks &&
      createdChildrenOrderItemsStocks.length > 0
    ) {
      const newOrderItemsGroup = group(
        createdStockOrderItemsStocks,
        "material_id"
      )

      for (const createdChildrenOrderItemsStock of createdChildrenOrderItemsStocks) {
        const newGroupedItems =
          newOrderItemsGroup[createdChildrenOrderItemsStock.material_id] || []

        for (const [index, newGroupedItem] of newGroupedItems.entries()) {
          if (index === 0) {
            const newFirstChildItemStock = {
              ...createdChildrenOrderItemsStock,
              stock_id: newGroupedItem.stock_id,
              allocated_qty: newGroupedItem.allocated_qty,
              stock_allocated_qty: newGroupedItem.stock_allocated_qty,
            }

            const { stock_allocated_qty, ...item } = newFirstChildItemStock
            promises.push(
              this.repository.updateStockAllocateById(c, item.stock_id, {
                allocated_qty: stock_allocated_qty
                  ? stock_allocated_qty + item.allocated_qty
                  : item.allocated_qty,
                updated_at: new Date(),
                updated_by: userId,
              })
            )
            promises.push(
              this.repository.createOrderItemStockAllocateByOrderItemId(c, item)
            )
          } else {
            const newOtherChildItemStock = {
              ...newGroupedItem,
              order_id: orderId,
              created_by: userId,
              created_at: new Date(),
            }

            const { stock_allocated_qty, ...item } = newOtherChildItemStock
            promises.push(
              this.repository.updateStockAllocateById(c, item.stock_id, {
                allocated_qty: stock_allocated_qty
                  ? stock_allocated_qty + item.allocated_qty
                  : item.allocated_qty,
                updated_at: new Date(),
                updated_by: userId,
              })
            )
            promises.push(
              this.repository.createOrderItemStockAllocateByOrderItemId(c, item)
            )
          }
        }
      }
    }
  }

  private handleGroupedOrderItem(
    c: Context,
    item: any,
    index: number,
    userId: number,
    orderId: number
  ) {
    const promises: any[] = []
    const { id, ...rest } = item
    const stock = { ...rest }

    if (index === 0) {
      delete stock.material_id
      delete stock.order_item_kfa_id
      promises.push(
        this.repository.updateStockAllocateById(c, stock.stock_id, {
          allocated_qty: stock.stock_allocated_qty
            ? stock.allocated_qty + stock.stock_allocated_qty
            : stock.allocated_qty,
          updated_at: new Date(),
          updated_by: userId,
        })
      )
      const { stock_allocated_qty, ...items } = stock
      promises.push(
        this.repository.updateOrderItemStockAllocateByOrderItemId(c, id, items)
      )
    } else {
      promises.push(
        this.repository.updateStockAllocateById(c, stock.stock_id, {
          allocated_qty: stock.stock_allocated_qty
            ? stock.allocated_qty + stock.stock_allocated_qty
            : stock.allocated_qty,
          updated_at: new Date(),
          updated_by: userId,
        })
      )
      const { stock_allocated_qty, ...items } = stock
      promises.push(
        this.repository.createOrderItemStockAllocateByOrderItemId(c, {
          ...items,
          order_id: orderId,
        })
      )
    }

    return promises
  }

  private handleSingleOrderItem(c: Context, item: any, userId: number) {
    const promises: any[] = []
    const { id, ...rest } = item
    const stock = { ...rest }

    delete stock.material_id
    delete stock.order_item_kfa_id

    promises.push(
      this.repository.updateStockAllocateById(c, stock.stock_id, {
        allocated_qty: stock.stock_allocated_qty
          ? stock.allocated_qty + stock.stock_allocated_qty
          : stock.allocated_qty,
        updated_at: new Date(),
        updated_by: userId,
      })
    )

    const { stock_allocated_qty, ...items } = stock
    promises.push(
      this.repository.updateOrderItemStockAllocateByOrderItemId(c, id, items)
    )

    return promises
  }

  private prepareOrderCommentData(
    c: Context,
    orderId: number,
    userId: number,
    comment: string
  ) {
    const orderCommentData: AddOrderCommentAllocateDTO = {
      order_id: orderId,
      user_id: userId,
      order_status_id: ORDER_STATUS.ALLOCATED,
      created_by: userId,
      updated_by: userId,
      created_at: new Date(),
      updated_at: new Date(),
      comment: comment,
    }
    return this.repository.createOrderCommentAllocate(c, orderCommentData)
  }
}
