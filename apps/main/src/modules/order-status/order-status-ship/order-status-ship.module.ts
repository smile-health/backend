import { DEVICE_TYPE } from "@/common/constants/device.js"
import { ORDER_STATUS } from "@/common/constants/order.js"
import { TRANSACTION_TYPE } from "@/common/constants/transaction.js"
import { Context } from "hono"
import { OrderStatusShipRepository } from "./order-status-ship.repository.js"
import {
  AddOrderCommentShipDTO,
  AddOrderHistoryShipDTO,
  ChangeOrderStatusShipDTO,
  ChangeOrderStatusShipRequest,
  OrderStatusShipEntityDTO,
  UpdateOrderAuditShipDTO,
} from "./order-status-ship.schema.js"
import { OrderStatusShippedPublisher } from "./order-status-ship.publisher.js"
import { TransactionPublisher } from "@/modules/transaction/transaction.publisher.js"
import { PublishTrxDTO } from "@/modules/transaction/transaction.schema.js"
import { NOTIFICATION_MEDIA } from "@smile-health/lib/rabbitmq/notification.js"
import { ValidationError } from "@smile-health/lib/error.js"
import { generateEventCode } from "@smile-health/lib/utils.js"
import { NotificationTypeRepository } from "@/common/repository/notification-type.js"
import { ColdstoragePublisher } from "@/modules/coldstorage/coldstorage.publisher.js"

export class OrderStatusShipModule {
  constructor(
    private readonly repository: OrderStatusShipRepository,
    private readonly publisher: OrderStatusShippedPublisher,
    private readonly transactionPublisher: TransactionPublisher,
    private readonly notificationTypeRepo: NotificationTypeRepository,
    private readonly coldstoragePublisher: ColdstoragePublisher
  ) {}

  async update(
    c: Context,
    orderId: number,
    body: ChangeOrderStatusShipRequest
  ) {
    const userId = Number(c.var.userId)
    const deviceType = c.req.header("device-type") ?? "web"
    const promises: any[] = []

    const order = await this.repository.getOrderById(
      c,
      orderId,
      c.get("programId")
    )
    const orderItemStocks = await this.repository.getOrderItemStockByOrderId(
      c,
      orderId
    )

    const newOrderItemStocks: any[] = await this.setNewOrderItemStocks(
      c,
      order,
      orderItemStocks
    )

    const today = new Date().toISOString().split("T")[0]
    const [userCustomers, userVendors, entityActivity] = await Promise.all([
      this.repository.getWsUsersByEntityId(
        c,
        order?.customer_id,
        c.get("programId")
      ),
      this.repository.getWsUsersByEntityId(
        c,
        order?.vendor_id,
        c.get("programId")
      ),
      this.repository.getWsEntityActivityByEntityActivityId(
        c,
        order!.vendor_id!,
        order!.activity_id!,
        today
      ),
    ])
    if (userCustomers.length === 0 && userVendors.length === 0) {
      throw new ValidationError("User Entity Customer and Vendor not found")
    }
    if (userCustomers.length === 0) {
      throw new ValidationError("User Entity Customer not found")
    }
    if (userVendors.length === 0) {
      throw new ValidationError("User Entity Vendor not found")
    }

    if (!entityActivity) {
      throw new ValidationError(
        c.var.t("entity.label.activity_implementation_time")
      )
    }

    const { users, customer, vendor } = await this.setUserNotification(
      c,
      Number(order?.customer_id),
      Number(order?.vendor_id),
      userCustomers,
      userVendors
    )

    const publishMessages: PublishTrxDTO[] = []

    const orderData: ChangeOrderStatusShipDTO = {
      order_status_id: ORDER_STATUS.SHIPPED,
      sales_ref: body.sales_ref ?? null,
      taken_by_customer: body.taken_by_customer ?? 0,
      updated_by: userId,
      updated_at: new Date(),
    }

    const orderHistoryData: AddOrderHistoryShipDTO = {
      order_id: orderId,
      order_status_id: ORDER_STATUS.SHIPPED,
      created_by: userId,
      updated_by: userId,
      created_at: new Date(),
      updated_at: new Date(),
    }

    const orderAuditData: UpdateOrderAuditShipDTO = {
      estimated_date: body.estimated_date ?? null,
      actual_shipment_date: body.actual_shipment_date,
      shipped_at: new Date(),
      updated_at: new Date(),
      shipped_by: userId,
      updated_by: userId,
    }

    promises.push(this.repository.update(c, orderData, { id: orderId }))

    promises.push(this.repository.createOrderHistoryShip(c, orderHistoryData))

    promises.push(
      this.repository.updateOrderAuditShipByOrderId(c, orderId, orderAuditData)
    )

    if (body.comment) {
      const orderCommentData: AddOrderCommentShipDTO = {
        order_id: orderId,
        user_id: userId,
        order_status_id: ORDER_STATUS.SHIPPED,
        comment: body.comment,
        created_by: userId,
        updated_by: userId,
        created_at: new Date(),
        updated_at: new Date(),
      }

      promises.push(this.repository.createOrderCommentShip(c, orderCommentData))
    }

    const material_ids: number[] = []
    // We'll update vendor stock & create transactions per-row as before,
    // but aggregate customer updates by (material_id, batch_id, manufacture_id)
    // and apply a single customer update/create per group (Option A: vendor unchanged).
    for (const orderItemStock of newOrderItemStocks) {
      material_ids.push(orderItemStock.stock_material_id!)
      const openingQty = orderItemStock.stock_qty
      const changeQty = -Math.abs(orderItemStock.item_stock_allocated_qty!)

      promises.push(
        this.repository.updateStockShip(c, orderItemStock.stock_id, {
          qty:
            orderItemStock.stock_qty - orderItemStock.item_stock_allocated_qty!,
          allocated_qty:
            orderItemStock.stock_allocated_qty! -
            orderItemStock.item_stock_allocated_qty!,
          in_transit_qty: orderItemStock.stock_in_transit_qty
            ? orderItemStock.stock_in_transit_qty +
            orderItemStock.item_stock_allocated_qty!
            : orderItemStock.item_stock_allocated_qty!,
          updated_by: userId,
          updated_at: new Date(),
        })
      )

      // customer stock updates will be handled after the vendor loop

      const shipTrx = await this.repository.createTransactionShip(c, {
        activity_id: orderItemStock.stock_activity_id!,
        opening_qty: openingQty,
        change_qty: changeQty,
        companion_entity_id: order?.customer_id,
        transaction_type_id: TRANSACTION_TYPE.ISSUES,
        entity_id: orderItemStock.stock_entity_id!,
        stock_id: orderItemStock.stock_id,
        order_id: orderId,
        device_type: DEVICE_TYPE[deviceType],
        batch_code: orderItemStock.batch_code,
        created_at: new Date(),
        updated_at: new Date(),
        created_by: userId,
        updated_by: userId,
        actual_transaction_date: body.actual_shipment_date,
        entity_activity_id: entityActivity.id,
        companion_entity_id: order!.customer_id!,
      })

      promises.push(shipTrx)

      promises.push(
        this.repository.createPurchaseShip(c, {
          transaction_id: shipTrx.insertId!,
          budget_source_id: orderItemStock.budget_source_id,
          year: orderItemStock.year,
          price: orderItemStock.price,
          total_price: orderItemStock.price
            ? orderItemStock.price * orderItemStock.item_stock_allocated_qty!
            : orderItemStock.price,
          created_at: new Date(),
          updated_at: new Date(),
          created_by: userId,
          updated_by: userId,
          source_id: shipTrx.insertId!,
          source_type: "transaction",
        })
      )

      if (shipTrx && shipTrx.insertId) {
        publishMessages.push({
          id: Number(shipTrx.insertId),
        })
      }
    }

    // Aggregate customer updates by (material_id, batch_id, manufacture_id)
    const customerAggMap = new Map<
      string,
      {
        sumAllocatedQty: number
        representative: any
      }
    >()

    for (const item of newOrderItemStocks) {
      const key = `${item.stock_material_id}|${item.batch_id ?? "__NB__"}|${item.manufacture_id ?? "__NM__"
        }`
      const current = customerAggMap.get(key)
      if (current) {
        current.sumAllocatedQty += item.item_stock_allocated_qty ?? 0
      } else {
        customerAggMap.set(key, {
          sumAllocatedQty: item.item_stock_allocated_qty ?? 0,
          representative: item,
        })
      }
    }

    // Apply aggregated customer updates (one per group)
    for (const { sumAllocatedQty, representative } of customerAggMap.values()) {
      if (sumAllocatedQty <= 0) continue

      if (
        representative.stock_customer_id &&
        representative.stock_customer_unreceived_qty >= 0
      ) {
        promises.push(
          this.repository.updateStockShip(c, representative.stock_customer_id, {
            unreceived_qty:
              representative.stock_customer_unreceived_qty + sumAllocatedQty,
            price: representative.price,
            total_price: representative.price
              ? representative.price * sumAllocatedQty
              : representative.price,
            year: representative.year,
            budget_source_id: representative.budget_source_id,
            updated_by: userId,
            updated_at: new Date(),
          })
        )
      } else {
        promises.push(
          this.repository.createStockCustomerShip(c, {
            qty: 0,
            batch_id: representative.batch_id!,
            entity_id: order!.customer_id!,
            material_id: representative.stock_material_id!,
            activity_id: order!.activity_id!,
            updated_at: new Date(),
            updated_by: userId,
            parent_material_id: representative.parent_material_id,
            unreceived_qty: sumAllocatedQty,
            price: representative.price,
            budget_source_id: representative.budget_source_id,
            batch_code: representative.batch_code,
            manufacture_id: representative.manufacture_id,
            year: representative.year,
            created_by: userId,
          })
        )
      }
    }

    await Promise.all(promises)

    // Trigger update of coldstorage
    await this.coldstoragePublisher.processCreate(c, {
      entity_id: order!.vendor_id!,
      program_id: c.var.programId,
      material_ids: material_ids,
      is_immunization: c.var.config?.is_immunization ?? false,
      user_id: userId,
    })

    await this.pushOrderToNotification(
      c,
      orderId,
      customer,
      vendor,
      newOrderItemStocks,
      users
    )

    await this.transactionPublisher.processCreate(c, publishMessages)

    await this.publisher.processUpdate(c, {
      order_id: orderId,
      program_id: Number(c.var.programId),
    })
  }

  private async setNewOrderItemStocks(c: Context, order, orderItemStocks) {
    let stockCustomersBatch,
      stockCustomersNonBatch: any[] = []
    // Use order.activity_id for customer stock queries (follow order activity)
    const stockActivityIds = [order!.activity_id!]

    const stockMaterialIds = orderItemStocks.map(
      (item) => item!.stock_material_id!
    )

    const stockBatchIds = orderItemStocks.map((item) => item!.batch_id!)

    // For non-batch customer stocks, use order.activity_id
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

    const newOrderItemStocks: any[] = []

    for (const orderItemStock of orderItemStocks) {
      let findStockCustomer

      if (
        orderItemStock.batch_id === null ||
        orderItemStock.batch_id === undefined
      ) {
        // match customer stock by order.activity_id (use order activity, not vendor stock activity)
        findStockCustomer = stockCustomers.find(
          (stockCustomer) =>
            order!.customer_id! === stockCustomer.entity_id &&
            order!.activity_id === stockCustomer.activity_id &&
            orderItemStock.stock_material_id === stockCustomer.material_id
        )
      } else {
        findStockCustomer = stockCustomers.find(
          (stockCustomer) =>
            order!.customer_id! === stockCustomer.entity_id &&
            order!.activity_id === stockCustomer.activity_id &&
            orderItemStock.stock_material_id === stockCustomer.material_id &&
            orderItemStock.manufacture_id === stockCustomer.manufacture_id &&
            orderItemStock.batch_id === stockCustomer.batch_id
        )
      }

      newOrderItemStocks.push({
        ...orderItemStock,
        stock_customer_id: findStockCustomer?.id ?? null,
        stock_customer_unreceived_qty:
          findStockCustomer?.unreceived_qty ?? null,
      })
    }

    const sorted = newOrderItemStocks.sort((a, b) =>
      a.stock_material_name.localeCompare(b.stock_material_name)
    )

    return sorted
  }

  private async setNotificationData(
    c: Context,
    orderId: number,
    materialName: string,
    unitOfConsumption: string,
    batchCode: string,
    shippedQty: number,
    customer: OrderStatusShipEntityDTO,
    vendor: OrderStatusShipEntityDTO,
    usersCustomerVendor
  ) {
    const type = "order-ship"
    const eventCode = await generateEventCode()
    const notifChannel =
      await this.notificationTypeRepo.generateNotificationChannels(c, type)
    for (const userCustomerVendor of usersCustomerVendor) {
      const entityId = userCustomerVendor.entity.id
      const messageData = this.setMessageNotification(
        orderId,
        materialName,
        unitOfConsumption,
        batchCode,
        shippedQty,
        vendor,
        customer,
        entityId
      )

      const titleData = this.setTitleNotification(orderId)
      const programId = c.get("programId")

      let template =
        entityId === vendor?.id
          ? "order_ship_without_batch_vendor"
          : "order_ship_without_batch"
      let variables = [
        orderId,
        materialName,
        unitOfConsumption,
        shippedQty,
        vendor?.name ?? "",
        customer?.name ?? "",
      ]

      if (batchCode) {
        template =
          entityId === vendor?.id
            ? "order_ship_with_batch_vendor"
            : "order_ship_with_batch"
        variables = [
          orderId,
          materialName,
          unitOfConsumption,
          batchCode,
          shippedQty,
          vendor?.name ?? "",
          customer?.name ?? "",
        ]
      }

      const payload = {
        event_code: eventCode,
        user: {
          user_id: userCustomerVendor.id,
          email: userCustomerVendor.email,
          mobile_phone: userCustomerVendor.mobile_phone,
          fcm_token: userCustomerVendor.fcm_token,
          entity_id: userCustomerVendor.entity.id,
          province_id: userCustomerVendor.entity.province_id
            ? userCustomerVendor.entity.province_id === ""
              ? null
              : userCustomerVendor.entity.province_id
            : null,
          regency_id: userCustomerVendor.entity.regency_id
            ? userCustomerVendor.entity.regency_id === ""
              ? null
              : userCustomerVendor.entity.regency_id
            : null,
        },
        user_entity_tag_id: userCustomerVendor.entity.entity_tag_id || null,
        message: messageData,
        title: titleData,
        type: type,
        worker: "",
        workerMedia: "",
        program_id: programId,
        template,
        variables,
      }

      for (const item of notifChannel) {
        if (
          (item.media === NOTIFICATION_MEDIA.WHATSAPP &&
            !userCustomerVendor.mobile_phone) ||
          (item.media === NOTIFICATION_MEDIA.FIREBASE &&
            !userCustomerVendor.fcm_token) ||
          (item.media === NOTIFICATION_MEDIA.EMAIL && !userCustomerVendor.email)
        ) {
          // Will skip process if payload not fulfilled
          continue
        } else {
          payload.worker = item.worker
          payload.workerMedia = item.media
          await this.publisher.processNotification(c, payload)
        }
      }
    }
  }

  private setMessageNotification(
    orderId: number,
    materialName: string,
    unitOfConsumption: string,
    batchCode: null | undefined | string,
    shippedQty: number,
    vendor: OrderStatusShipEntityDTO,
    customer: OrderStatusShipEntityDTO,
    entityId: number
  ) {
    if (batchCode) {
      const dataWithBatch = {
        order_id: orderId,
        material_name: materialName,
        unit_of_consumption: unitOfConsumption,
        batch_code: batchCode,
        vendor_name: vendor?.name ?? "",
        shipped_qty: shippedQty,
        customer_name: customer?.name ?? "",
      }

      const key =
        entityId === vendor?.id
          ? "notification.message.order_ship_with_batch_vendor"
          : "notification.message.order_ship_with_batch"
      const jsonData = JSON.stringify(dataWithBatch)
      return `${key}, ${jsonData}`
    }

    const dataWithoutBatch = {
      order_id: orderId,
      material_name: materialName,
      unit_of_consumption: unitOfConsumption,
      vendor_name: vendor?.name ?? "",
      shipped_qty: shippedQty,
      customer_name: customer?.name ?? "",
    }

    const key =
      entityId === vendor?.id
        ? "notification.message.order_ship_without_batch_vendor"
        : "notification.message.order_ship_without_batch"

    const jsonData = JSON.stringify(dataWithoutBatch)
    return `${key}, ${jsonData}`
  }

  private setTitleNotification(orderId: number) {
    const data = {
      order_id: orderId,
    }
    const jsonData = JSON.stringify(data)
    return `notification.title.order_ship, ${jsonData}`
  }

  private async setUserNotification(
    c: Context,
    customerId: number,
    vendorId: number,
    userCustomers,
    userVendors
  ) {
    const usersCustomerVendor = [...userCustomers, ...userVendors]

    const uniqueEntityIds = [
      ...new Set(usersCustomerVendor.map((item) => item.entity_id)),
    ]

    const entitiesVendorCustomer = await this.repository.getWsEntitiesByIds(
      c,
      uniqueEntityIds,
      c.get("programId")
    )

    const customer = entitiesVendorCustomer.find(
      (item) => item.id === customerId
    )
    const vendor = entitiesVendorCustomer.find((item) => item.id === vendorId)

    const userEntities = Object.fromEntries(
      entitiesVendorCustomer.map((item) => [item.id, item])
    )

    const result = usersCustomerVendor.map(({ entity_id, ...rest }) => ({
      ...rest,
      entity: userEntities[entity_id] || null,
    }))

    return {
      users: result,
      customer,
      vendor,
    }
  }

  private async pushOrderToNotification(
    c: Context,
    orderId: number,
    customer: OrderStatusShipEntityDTO,
    vendor: OrderStatusShipEntityDTO,
    newOrderItemStocks,
    usersCustomerVendor
  ) {
    const orderToPushNotif = newOrderItemStocks[0]

    await this.setNotificationData(
      c,
      orderId,
      orderToPushNotif.stock_material_name,
      orderToPushNotif.stock_material_unit_of_consumption,
      orderToPushNotif.batch_code,
      orderToPushNotif.item_stock_allocated_qty,
      customer,
      vendor,
      usersCustomerVendor
    )

    return true
  }
}
