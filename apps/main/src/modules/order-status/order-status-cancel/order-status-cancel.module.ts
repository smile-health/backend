import { DEVICE_TYPE } from "@/common/constants/device.js"
import {
  ORDER_CANCEL_REASON,
  ORDER_STATUS,
  ORDER_TYPE,
} from "@/common/constants/order.js"
import { TRANSACTION_TYPE } from "@/common/constants/transaction.js"
import { TransactionPublisher } from "@/modules/transaction/transaction.publisher.js"
import { PublishTrxDTO } from "@/modules/transaction/transaction.schema.js"
import { Context } from "hono"
import { OrderStatusCancelPublisher } from "./order-status-cancel.publisher.js"
import { OrderStatusCancelRepository } from "./order-status-cancel.repository.js"
import {
  AddOrderCommentCancelDTO,
  AddOrderHistoryCancelDTO,
  AddOtherReasonCancelDTO,
  ChangeOrderStatusCancelDTO,
  ChangeOrderStatusCancelRequest,
  UpdateOrderAuditCancelDTO,
} from "./order-status-cancel.schema.js"
import { ColdstoragePublisher } from "@/modules/coldstorage/coldstorage.publisher.js"

export class OrderStatusCancelModule {
  constructor(
    private readonly repository: OrderStatusCancelRepository,
    private readonly coldstoragePublisher: ColdstoragePublisher,
    private readonly publisher?: OrderStatusCancelPublisher,
    private readonly transactionPublisher?: TransactionPublisher
  ) {}

  async update(
    c: Context,
    orderId: number,
    body: ChangeOrderStatusCancelRequest
  ) {
    const { order_cancel_reason_id, other_reason, comment } = body
    const userId = Number(c.var.userId)
    const promises: any[] = []

    const allowedUpdateIsAllocated = [
      ORDER_STATUS.PENDING,
      ORDER_STATUS.CONFIRMED,
      ORDER_STATUS.ALLOCATED,
    ]

    const allowedStatusUpdateStock = [
      ORDER_STATUS.ALLOCATED,
      ORDER_STATUS.SHIPPED,
    ]

    const allowedTypeUpdateTransaction = [
      ORDER_TYPE.REQUEST,
      ORDER_TYPE.DISTRIBUTION,
      ORDER_TYPE.RETURN,
      ORDER_TYPE.RELOCATION,
    ]

    const order = await this.repository.getOrderById(
      c,
      orderId,
      c.var.programId
    )

    const orderItemStocks = await this.repository.getOrderItemStockByOrderId(
      c,
      orderId
    )

    const wsPurchase = await this.repository.getWsPurchaseByOrderId(
      c,
      orderId,
      TRANSACTION_TYPE.ISSUES
    )

    const publishMessages: PublishTrxDTO[] = []

    const orderData: ChangeOrderStatusCancelDTO = {
      order_status_id: ORDER_STATUS.CANCELED,
      is_allocated: allowedUpdateIsAllocated.includes(order!.order_status_id)
        ? 0
        : 1,
      updated_by: userId,
      updated_at: new Date(),
      order_cancel_reason_id: order_cancel_reason_id,
    }

    const orderHistoryData: AddOrderHistoryCancelDTO = {
      order_id: orderId,
      order_status_id: ORDER_STATUS.CANCELED,
      created_by: userId,
      updated_by: userId,
      created_at: new Date(),
      updated_at: new Date(),
    }

    const orderAuditData: UpdateOrderAuditCancelDTO = {
      cancelled_at: new Date(),
      updated_at: new Date(),
      cancelled_by: userId,
      updated_by: userId,
    }

    promises.push(this.repository.update(c, orderData, { id: orderId }))

    promises.push(this.repository.createOrderHistoryCancel(c, orderHistoryData))

    promises.push(
      this.repository.updateOrderAuditCancelByOrderId(
        c,
        orderId,
        orderAuditData
      )
    )

    if (
      order_cancel_reason_id &&
      order_cancel_reason_id === ORDER_CANCEL_REASON.OTHERS &&
      other_reason
    ) {
      const otherReasonData: AddOtherReasonCancelDTO = {
        source_id: orderId,
        source_type: "order",
        content: other_reason,
        created_at: new Date(),
        updated_at: new Date(),
      }
      promises.push(this.repository.createOtherReasonCancel(c, otherReasonData))
    }

    if (comment) {
      const orderCommentData: AddOrderCommentCancelDTO = {
        order_id: orderId,
        user_id: userId,
        order_status_id: ORDER_STATUS.CANCELED,
        comment: comment,
        created_by: userId,
        updated_by: userId,
        created_at: new Date(),
        updated_at: new Date(),
      }
      promises.push(
        this.repository.createOrderCommentCancel(c, orderCommentData)
      )
    }

    let material_ids: number[] = []
    if (allowedStatusUpdateStock.includes(order!.order_status_id)) {
      const newOrderItemStocks: any[] = await this.setNewOrderItemStocks(
        c,
        order,
        orderItemStocks
      )

      for (const orderItemStock of newOrderItemStocks) {
        if (order?.order_status_id === ORDER_STATUS.ALLOCATED) {
          promises.push(
            this.repository.updateStockVendorCustomerCancelById(
              c,
              orderItemStock.stock_id,
              {
                allocated_qty:
                  orderItemStock.stock_allocated_qty! -
                  orderItemStock.item_stock_allocated_qty!,
                updated_at: new Date(),
                updated_by: userId,
              }
            )
          )
          promises.push(
            this.repository.updateOrderItemStockCancelById(
              c,
              orderItemStock.item_stock_id,
              {
                allocated_qty: 0,
                updated_at: new Date(),
                updated_by: userId,
              }
            )
          )
        } else {
          material_ids.push(orderItemStock.stock_material_id!)
          if (order!.order_type_id! === ORDER_TYPE.CENTRAL_DISTRIBUTION) {
            promises.push(
              this.repository.updateStockVendorCustomerCancelById(
                c,
                orderItemStock.stock_id,
                {
                  qty: orderItemStock.stock_qty,
                  in_transit_qty:
                    orderItemStock.stock_in_transit_qty > 0
                      ? orderItemStock.stock_in_transit_qty! -
                        orderItemStock.item_stock_allocated_qty!
                      : 0,
                  updated_at: new Date(),
                  updated_by: userId,
                }
              )
            )
          } else {
            promises.push(
              this.repository.updateStockVendorCustomerCancelById(
                c,
                orderItemStock.stock_id,
                {
                  qty:
                    orderItemStock.stock_qty +
                    orderItemStock.item_stock_allocated_qty!,
                  in_transit_qty:
                    orderItemStock.stock_in_transit_qty! > 0
                      ? orderItemStock.stock_in_transit_qty! -
                        orderItemStock.item_stock_allocated_qty!
                      : 0,
                  updated_at: new Date(),
                  updated_by: userId,
                }
              )
            )
          }

          promises.push(
            this.repository.updateStockVendorCustomerCancelById(
              c,
              orderItemStock.stock_customer_id,
              {
                unreceived_qty:
                  orderItemStock.stock_customer_unreceived_qty -
                  orderItemStock.item_stock_allocated_qty!,
                updated_by: userId,
                updated_at: new Date(),
              }
            )
          )

          if (allowedTypeUpdateTransaction.includes(order!.order_type_id)) {
            const cancelTrx = await this.repository.createTransactionCancel(c, {
              activity_id: orderItemStock.stock_activity_id!,
              opening_qty: orderItemStock.stock_qty,
              change_qty: orderItemStock.item_stock_allocated_qty!,
              transaction_type_id: TRANSACTION_TYPE.RECEIPTS,
              entity_id: orderItemStock.stock_entity_id!,
              stock_id: orderItemStock.stock_id,
              order_id: orderId,
              device_type: c.var.deviceType ?? DEVICE_TYPE.web,
              batch_code: orderItemStock.batch_code,
              created_at: new Date(),
              updated_at: new Date(),
              created_by: userId,
              updated_by: userId,
            })

            promises.push(cancelTrx)
            const findWsPurchase = wsPurchase.find(
              (p) => p.stock_id === orderItemStock.stock_id
            )

            promises.push(
              this.repository.createPurchaseShip(c, {
                transaction_id: cancelTrx.insertId!,
                budget_source_id: findWsPurchase?.budget_source_id
                  ? findWsPurchase?.budget_source_id
                  : orderItemStock.budget_source_id,
                year: findWsPurchase?.year
                  ? findWsPurchase?.year
                  : orderItemStock.year,
                price: findWsPurchase?.price
                  ? findWsPurchase.price
                  : orderItemStock.price,
                total_price: findWsPurchase?.price
                  ? findWsPurchase?.price *
                    orderItemStock.item_stock_allocated_qty!
                  : orderItemStock.price,
                created_at: new Date(),
                updated_at: new Date(),
                created_by: userId,
                updated_by: userId,
                source_id: cancelTrx.insertId!,
                source_type: "transaction",
              })
            )

            if (cancelTrx && cancelTrx.insertId) {
              publishMessages.push({
                id: Number(cancelTrx.insertId),
              })
            }
          }
        }
      }
    }

    await Promise.all(promises)

    // Trigger update of coldstorage
    if (material_ids.length > 0) {
      await this.coldstoragePublisher.processCreate(c, {
        entity_id: order!.vendor_id!,
        program_id: c.var.programId,
        material_ids: material_ids,
        is_immunization: c.var.config?.is_immunization ?? false,
        user_id: userId,
      })
    }

    if (this.transactionPublisher)
      await this.transactionPublisher.processCreate(c, publishMessages)

    if (this.publisher)
      await this.publisher.processUpdate(c, {
        order_id: orderId,
        program_id: c.var.programId,
        cancel_reason: order_cancel_reason_id,
        reason_text: other_reason,
        comment: comment,
      })
  }

  private async setNewOrderItemStocks(c: Context, order, orderItemStocks) {
    let stockCustomersBatch: any[] = []
    let stockCustomersNonBatch: any[] = []

    const stockActivityIds = orderItemStocks.map(
      (item) => item!.stock_activity_id!
    )

    const stockMaterialIds = orderItemStocks.map(
      (item) => item!.stock_material_id!
    )

    const stockBatchIds = orderItemStocks.map((item) => item!.batch_id!)

    const stockActivityNonBatchIds = orderItemStocks
      .filter((item) => item.stock_batch_id == null)
      .map((item) => item.stock_activity_id!)

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
    const newOrderItemStocks: any[] = []

    for (const orderItemStock of orderItemStocks) {
      let findStockCustomer

      if (
        orderItemStock.batch_id === null ||
        orderItemStock.batch_id === undefined
      ) {
        findStockCustomer = stockCustomers.find(
          (stockCustomer) =>
            order!.customer_id! === stockCustomer.entity_id &&
            orderItemStock.stock_activity_id === stockCustomer.activity_id &&
            orderItemStock.stock_material_id === stockCustomer.material_id
        )
      } else {
        findStockCustomer = stockCustomers.find(
          (stockCustomer) =>
            order!.customer_id! === stockCustomer.entity_id &&
            orderItemStock.stock_activity_id === stockCustomer.activity_id &&
            orderItemStock.stock_material_id === stockCustomer.material_id &&
            orderItemStock.manufacture_id === stockCustomer.manufacture_id &&
            orderItemStock.batch_id === stockCustomer.batch_id
        )
      }
      let stockCustomerId, stockCustomerUnreceivedQty

      // Handle the case where the stock customer is not found
      if (findStockCustomer === undefined) {
        const create = await this.repository.createStockCustomerCancel(c, {
          qty: 0,
          batch_id: orderItemStock.batch_id,
          entity_id: order!.customer_id!,
          activity_id: orderItemStock.stock_activity_id!,
          material_id: orderItemStock.stock_material_id!,
          parent_material_id: orderItemStock.parent_material_id,
          unreceived_qty: orderItemStock.item_stock_allocated_qty,
          created_at: new Date(),
          updated_at: new Date(),
          created_by: c.var.programId,
          updated_by: c.var.programId,
          price: orderItemStock.price,
          year: orderItemStock.year,
          batch_code: orderItemStock.batch_code,
          manufacture_id: orderItemStock.manufacture_id,
          budget_source_id: orderItemStock.budget_source_id,
        })
        stockCustomerId = Number(create.insertId)
        stockCustomerUnreceivedQty = orderItemStock.item_stock_allocated_qty
      } else {
        stockCustomerId = findStockCustomer.id
        stockCustomerUnreceivedQty = findStockCustomer.unreceived_qty
      }

      newOrderItemStocks.push({
        ...orderItemStock,
        stock_customer_id: stockCustomerId,
        stock_customer_unreceived_qty: stockCustomerUnreceivedQty,
      })
    }

    return newOrderItemStocks
  }
}
