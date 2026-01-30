import { DEVICE_TYPE } from "@/common/constants/device.js"
import { ORDER_STATUS } from "@/common/constants/order.js"
import { TRANSACTION_TYPE } from "@/common/constants/transaction.js"
import { NotificationPublisher } from "@/modules/notification/notification.publisher.js"
import { NotificationRepository } from "@/modules/notification/notification.repository.js"
import { TransactionPublisher } from "@/modules/transaction/transaction.publisher.js"
import { PublishTrxDTO } from "@/modules/transaction/transaction.schema.js"
import { associate } from "@smile-health/lib/utils.js"
import { Context } from "hono"
import moment from "moment"
import { OrderStatusFulfilledPublisher } from "./order-status-fulfilled.publisher.js"
import { OrderStatusFulfilledRepository } from "./order-status-fulfilled.repository.js"
import {
  AddOrderCommentFulfilledDTO,
  AddOrderHistoryFulfilledDTO,
  ChangeOrderStatusFulfilledDTO,
  ChangeOrderStatusFulfilledRequest,
  UpdateOrderAuditFulfilledDTO,
} from "./order-status-fulfilled.schema.js"
import { BadRequestError } from "@smile-health/lib/error.js"
import { ColdstoragePublisher } from "@/modules/coldstorage/coldstorage.publisher.js"

export class OrderStatusFulfilledModule {
  constructor(
    private readonly repository: OrderStatusFulfilledRepository,
    private readonly publisher: OrderStatusFulfilledPublisher,
    private readonly transactionPublisher: TransactionPublisher,
    private readonly notificationPublisher: NotificationPublisher,
    private readonly notificationRepository: NotificationRepository,
    private readonly coldstoragePublisher: ColdstoragePublisher
  ) {}

  async update(
    c: Context,
    orderId: number,
    body: ChangeOrderStatusFulfilledRequest
  ) {
    const { order_items, comment, fulfilled_at } = body
    const userId = Number(c.var.userId)
    const deviceType = c.req.header("device-type") ?? "web"
    const promises: any[] = []

    const order = await this.repository.getOrderById(
      c,
      orderId,
      c.get("programId")
    )
    const publishMessages: PublishTrxDTO[] = []

    const orderItemStocks = await this.repository.getOrderItemStockByOrderId(
      c,
      orderId
    )

    const today = new Date().toISOString().split("T")[0]
    const entityActivity =
      await this.repository.getWsEntityActivityByEntityActivityId(
        c,
        order!.customer_id!,
        order!.activity_id!,
        today
      )
    if (!entityActivity) {
      // Handle case where entityActivity is not found
      throw new BadRequestError(
        c.var.t("validator.not_found", {
          field: c.var.t("entity.label.activity_implementation_time"),
        })
      )
    }

    const orderData: ChangeOrderStatusFulfilledDTO = {
      order_status_id: ORDER_STATUS.FULFILLED,
      updated_by: userId,
      updated_at: new Date(),
    }

    const orderHistoryData: AddOrderHistoryFulfilledDTO = {
      order_id: orderId,
      order_status_id: ORDER_STATUS.FULFILLED,
      created_by: userId,
      updated_by: userId,
      created_at: new Date(),
      updated_at: new Date(),
    }

    const orderAuditData: UpdateOrderAuditFulfilledDTO = {
      fulfilled_at: fulfilled_at,
      updated_at: new Date(),
      fulfilled_by: userId,
      updated_by: userId,
    }

    promises.push(this.repository.update(c, orderData, { id: orderId }))

    promises.push(
      this.repository.createOrderHistoryFulfilled(c, orderHistoryData)
    )

    promises.push(
      this.repository.updateOrderAuditFulfilledByOrderId(
        c,
        orderId,
        orderAuditData
      )
    )

    if (comment) {
      const orderCommentData: AddOrderCommentFulfilledDTO = {
        order_id: orderId,
        user_id: userId,
        order_status_id: ORDER_STATUS.FULFILLED,
        comment: comment,
        created_by: userId,
        updated_by: userId,
        created_at: new Date(),
        updated_at: new Date(),
      }

      promises.push(
        this.repository.createOrderCommentFulfilled(c, orderCommentData)
      )
    }

    const orderItemsData = order_items.flatMap((orderItem) => {
      if (Array.isArray(orderItem.receives) && orderItem.receives.length > 0) {
        return orderItem.receives.map((receive) => ({
          id: orderItem.id,
          stock_id: receive.stock_id,
          received_qty: receive.received_qty,
          updated_by: userId,
          updated_at: new Date(),
        }))
      }

      if (Array.isArray(orderItem.children) && orderItem.children.length > 0) {
        return orderItem.children.flatMap((child) => {
          if (Array.isArray(child.receives) && child.receives.length > 0) {
            return child.receives.map((receive) => ({
              id: child.id,
              stock_id: receive.stock_id,
              received_qty: receive.received_qty,
              updated_by: userId,
              updated_at: new Date(),
            }))
          }
          return []
        })
      }

      return []
    })

    const updatedOrderItems = orderItemsData.map((orderItemData) => {
      const updatedOrderItem = orderItemStocks.find(
        (orderItemStock) => orderItemStock.stock_id === orderItemData.stock_id
      )
      return {
        ...orderItemData,
        manufacture_id: updatedOrderItem!.manufacture_id,
        order_stock_id: updatedOrderItem!.id,
        parent_material_id: updatedOrderItem?.parent_material_id,
      }
    })

    const stocksIds = updatedOrderItems
      .map((updatedOrderItem) => updatedOrderItem.stock_id)
      .filter((id) => id !== null)

    const stocks = await this.repository.getStockByIds(c, stocksIds)
    const wsPurchase = await this.repository.getWsPurchaseByOrderId(
      c,
      orderId,
      TRANSACTION_TYPE.ISSUES
    )

    const updatedOrderItemsStocks = updatedOrderItems.map(
      (updatedOrderItem) => {
        const updatedOrderItemStock = stocks.find(
          (stock) => stock.id === updatedOrderItem.stock_id
        )

        return {
          ...updatedOrderItem,
          stock_qty: updatedOrderItemStock!.qty,
          stock_in_transit_qty: updatedOrderItemStock!.in_transit_qty,
          stock_entity_id: updatedOrderItemStock!.entity_id,
          stock_material_id: updatedOrderItemStock!.material_id,
          stock_activity_id: updatedOrderItemStock!.activity_id,
          stock_batch_id: updatedOrderItemStock!.batch_id,
          stock_batch_code: updatedOrderItemStock!.batch_code,
          budget_source_id: updatedOrderItemStock?.budget_source_id,
          year: updatedOrderItemStock?.year,
          price: updatedOrderItemStock?.price,
        }
      }
    )

    const newUpdatedOrderItemsStocks: any[] = await this.setNewOrderItemStocks(
      c,
      order,
      updatedOrderItemsStocks
    )

    // Capture old stock values before updates for notification
    // Use order.activity_id for customer-related stock notifications
    for (const updatedOrderItemsStock of newUpdatedOrderItemsStocks) {
      const parentMaterialId =
        await this.notificationRepository.getParentMaterialId(
          c,
          order!.customer_id!,
          updatedOrderItemsStock.stock_material_id!,
          order!.activity_id!
        )
      const oldStockValue = parentMaterialId
        ? await this.notificationRepository.getCurrentStock(
            c,
            order!.customer_id!,
            parentMaterialId,
            order!.activity_id!
          )
        : 0
      updatedOrderItemsStock.oldStockValue = Number(oldStockValue)
    }

    let material_ids: number[] = []
    for (const updatedOrderItemsStock of newUpdatedOrderItemsStocks) {
      material_ids.push(updatedOrderItemsStock.stock_material_id!)
      console.log(updatedOrderItemsStock)
      promises.push(
        this.repository.updateOrderItemStockFulfilledByOrderStockId(
          c,
          updatedOrderItemsStock.order_stock_id,
          {
            received_qty: updatedOrderItemsStock.received_qty,
            updated_at: new Date(),
            updated_by: userId,
            fulfill_stock_status_id:
              updatedOrderItemsStock.fulfill_stock_status_id ?? null,
          }
        )
      )
      promises.push(
        this.repository.updateStockVendorCustomerFulfilledById(
          c,
          updatedOrderItemsStock.stock_id,
          {
            in_transit_qty:
              updatedOrderItemsStock.stock_in_transit_qty! > 0
                ? updatedOrderItemsStock.stock_in_transit_qty -
                  updatedOrderItemsStock.received_qty
                : 0,
            updated_at: new Date(),
            updated_by: userId,
          }
        )
      )
      // Customer updates will be aggregated and applied after the loop
      const fulfilledTrx = await this.repository.createTransactionFulfilled(c, {
        // use order.activity_id for the transaction activity (follow order context)
        activity_id: order!.activity_id!,
        opening_qty: updatedOrderItemsStock.stock_customer_qty,
        change_qty: updatedOrderItemsStock.received_qty,
        transaction_type_id: TRANSACTION_TYPE.RECEIPTS,
        entity_id: order!.customer_id,
        stock_id: updatedOrderItemsStock.stock_customer_id,
        order_id: orderId,
        device_type: DEVICE_TYPE[deviceType],
        batch_code: updatedOrderItemsStock.stock_batch_code!,
        created_at: new Date(),
        updated_at: new Date(),
        created_by: userId,
        updated_by: userId,
        actual_transaction_date: fulfilled_at,
        entity_activity_id: entityActivity.id,
        companion_entity_id: order!.vendor_id!,
      })
      promises.push(fulfilledTrx)
      const findWsPurchase = wsPurchase.find(
        (p) => p.stock_id === updatedOrderItemsStock.stock_id
      )
      promises.push(
        this.repository.createPurchaseShip(c, {
          transaction_id: fulfilledTrx.insertId!,
          budget_source_id:
            findWsPurchase?.budget_source_id ??
            updatedOrderItemsStock.budget_source_id,
          year: findWsPurchase?.year ?? updatedOrderItemsStock.year,
          price: findWsPurchase?.price ?? updatedOrderItemsStock.price,
          total_price: findWsPurchase?.price
            ? findWsPurchase?.price * updatedOrderItemsStock.received_qty
            : updatedOrderItemsStock.price,
          created_at: new Date(),
          updated_at: new Date(),
          created_by: userId,
          updated_by: userId,
          source_id: fulfilledTrx.insertId!,
          source_type: "transaction",
        })
      )
      publishMessages.push({
        id: Number(fulfilledTrx.insertId),
      })
    }

    // Aggregate customer updates by stock_customer_id and apply once per customer stock
    const customerAggMap = new Map<
      number,
      { sumReceived: number; stockCustomerQty: number; stockCustomerUnreceivedQty: number }
    >()

    for (const updatedItem of newUpdatedOrderItemsStocks) {
      const cid = Number(updatedItem.stock_customer_id)
      if (!cid) continue
      const current = customerAggMap.get(cid)
      if (current) {
        current.sumReceived += updatedItem.received_qty ?? 0
      } else {
        customerAggMap.set(cid, {
          sumReceived: updatedItem.received_qty ?? 0,
          stockCustomerQty: updatedItem.stock_customer_qty ?? 0,
          stockCustomerUnreceivedQty: updatedItem.stock_customer_unreceived_qty ?? 0,
        })
      }
    }

    for (const [stockCustomerId, agg] of customerAggMap.entries()) {
      promises.push(
        this.repository.updateStockVendorCustomerFulfilledById(c, stockCustomerId, {
          qty: agg.stockCustomerQty + agg.sumReceived,
          updated_at: new Date(),
          updated_by: userId,
          unreceived_qty:
            agg.stockCustomerUnreceivedQty > 0
              ? Math.max(agg.stockCustomerUnreceivedQty - agg.sumReceived, 0)
              : 0,
        })
      )
    }

    await Promise.all(promises)

    // Trigger update of coldstorage
    await this.coldstoragePublisher.processCreate(c, {
      entity_id: order!.customer_id!,
      program_id: c.var.programId,
      material_ids: material_ids,
      is_immunization: c.var.config?.is_immunization ?? false,
      user_id: userId,
    })

    const materialIdOrderItem = associate(
      updatedOrderItemsStocks,
      "id",
      "stock_material_id"
    )
    const batchIdOrderItem = associate(
      updatedOrderItemsStocks,
      "stock_id",
      "stock_batch_id"
    )
    const dataOrderStockPublish = order_items.map((orderItem) => {
      if (Array.isArray(orderItem.receives) && orderItem.receives.length > 0) {
        return {
          id: orderItem.id,
          material_id: materialIdOrderItem[orderItem.id] as number,
          order_stock_fulfill: orderItem.receives.map((receive) => ({
            stock_id: receive.stock_id,
            batch_id: batchIdOrderItem[receive.stock_id] as number,
            status: null,
            fulfill_reason: null,
            other_reason: null,
            received_qty: receive.received_qty,
          })),
        }
      }

      if (Array.isArray(orderItem.children) && orderItem.children.length > 0) {
        return orderItem.children.flatMap((child) => {
          if (Array.isArray(child.receives) && child.receives.length > 0) {
            return {
              id: orderItem.id,
              material_id: materialIdOrderItem[orderItem.id] as number,
              order_stock_fulfill: child.receives.map((receive) => ({
                stock_id: receive.stock_id,
                batch_id: batchIdOrderItem[receive.stock_id] as number,
                status: null,
                fulfill_reason: null,
                other_reason: null,
                received_qty: receive.received_qty,
              })),
            }
          }
        })
      }
    })

    await this.publisher.processUpdate(c, {
      program_id: c.get("programId"),
      order_id: orderId,
      comment,
      fulfilled_at: moment(fulfilled_at).format("YYYY-MM-DD"),
      order_items: dataOrderStockPublish ?? [],
    })
    await this.transactionPublisher.processCreate(c, publishMessages)

    // Trigger stock back to normal notifications (use order.activity_id)
    for (const orderItemStock of newUpdatedOrderItemsStocks) {
      await this.notificationPublisher.publishStockBackToNormalCheck(
        c,
        order!.customer_id!,
        orderItemStock.stock_material_id!,
        order!.activity_id!,
        Number(orderItemStock.oldStockValue)
      )
    }
  }

  private async setNewOrderItemStocks(c: Context, order, orderItemStocks) {
    let stockCustomersBatch: any[] = []
    let stockCustomersNonBatch: any[] = []

    // Use order.activity_id for customer stock queries (follow order activity, not vendor stock activity)
    const stockActivityIds = [order!.activity_id!]
    const stockMaterialIds = orderItemStocks.map(
      (item) => item!.stock_material_id!
    )
    const stockBatchIds = orderItemStocks.map((item) => item!.stock_batch_id!)

    // For non-batch customer stocks, use the order activity
    const stockActivityNonBatchIds =
      orderItemStocks.filter((item) => item.stock_batch_id == null).length > 0
        ? [order!.activity_id!]
        : []

    const stockMaterialNonBatchIds = orderItemStocks
      .filter((item) => item.stock_batch_id == null)
      .map((item) => item.stock_material_id!)

    if (
      stockActivityNonBatchIds.length > 0 &&
      stockMaterialNonBatchIds.length > 0
    ) {
      stockCustomersNonBatch = await this.repository.getStockCustomersNoBatch(
        c,
        order!.customer_id!,
        stockActivityNonBatchIds,
        stockMaterialNonBatchIds
      )
    }

    if (stockBatchIds.length > 0) {
      stockCustomersBatch = await this.repository.getStockCustomers(
        c,
        order!.customer_id!,
        stockActivityIds,
        stockMaterialIds,
        stockBatchIds
      )
    }

    const stockCustomers = stockCustomersNonBatch.concat(stockCustomersBatch)

    // Group order items by (material_id|batch_id|manufacture_id) to create at most one customer stock per group
    const groups = new Map<
      string,
      { items: any[]; sumReceived: number; existingCustomer?: any }
    >()

    for (const item of orderItemStocks) {
      const key = `${item.stock_material_id}|${item.stock_batch_id ?? "__NB__"}|${
        item.manufacture_id ?? "__NM__"
      }`
      const g = groups.get(key)
      if (g) {
        g.items.push(item)
        g.sumReceived += item.received_qty ?? 0
      } else {
        // try to find existing customer stock for this group
        const findStockCustomer = (item.stock_batch_id === null ||
        item.stock_batch_id === undefined
          ? stockCustomers.find(
              (stockCustomer) =>
                order!.customer_id! === stockCustomer.entity_id &&
                order!.activity_id === stockCustomer.activity_id &&
                item.stock_material_id === stockCustomer.material_id
            )
          : stockCustomers.find(
              (stockCustomer) =>
                order!.customer_id! === stockCustomer.entity_id &&
                order!.activity_id === stockCustomer.activity_id &&
                item.stock_material_id === stockCustomer.material_id &&
                item.manufacture_id === stockCustomer.manufacture_id &&
                item.stock_batch_id === stockCustomer.batch_id
            )) || undefined

        groups.set(key, {
          items: [item],
          sumReceived: item.received_qty ?? 0,
          existingCustomer: findStockCustomer,
        })
      }
    }

    const newOrderItemStocks: any[] = []

    // For each group, create customer stock if missing (once) and assign to all group items
    for (const [key, group] of groups.entries()) {
      let stockCustomerId: number | null = null
      let stockCustomerQty = 0
      let stockCustomerUnreceivedQty = 0

      if (group.existingCustomer) {
        stockCustomerId = group.existingCustomer.id
        stockCustomerQty = group.existingCustomer.qty
        stockCustomerUnreceivedQty = group.existingCustomer.unreceived_qty
      } else {
        const representative = group.items[0]
        const create = await this.repository.createStockCustomerFulfilled(c, {
          qty: 0,
          batch_id: representative.stock_batch_id,
          entity_id: order!.customer_id!,
          activity_id: order!.activity_id!,
          material_id: representative.stock_material_id,
          updated_at: new Date(),
          updated_by: c.get("userId"),
          created_by: c.get("userId"),
          parent_material_id: representative.parent_material_id,
          unreceived_qty: group.sumReceived,
          price: representative.price,
          year: representative.year,
          budget_source_id: representative.budget_source_id,
          batch_code: representative.stock_batch_code,
          manufacture_id: representative.manufacture_id,
        })
        stockCustomerId = Number(create.insertId)
        stockCustomerQty = 0
        stockCustomerUnreceivedQty = group.sumReceived
      }

      for (const item of group.items) {
        newOrderItemStocks.push({
          ...item,
          stock_customer_id: stockCustomerId,
          stock_customer_qty: stockCustomerQty,
          stock_customer_unreceived_qty: stockCustomerUnreceivedQty,
        })
      }
    }

    return newOrderItemStocks
  }
}
