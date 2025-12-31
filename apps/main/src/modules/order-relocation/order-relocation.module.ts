import { DEVICE_TYPE } from "@/common/constants/device.js"
import {
  IS_ALLOCATED,
  ORDER_REASON,
  ORDER_STATUS,
  ORDER_TYPE,
} from "@/common/constants/order.js"
import { Context } from "hono"
import { OrderRelocationRepository } from "./order-relocation.repository.js"
import { OrderCommentRepository } from "../order-comment/order-comment.repository.js"
import { OrderItemStockRepository } from "../order-item-stock/order-item-stock.repository.js"
import { OrderAuditRepository } from "../order-audit/order-audit.repository.js"
import { OrderHistoryRepository } from "../order-history/order-history.repository.js"
import { CreateOrderAuditDTO } from "../order-audit/order-audit.schema.js"
import { CreateOrderCommentDTO } from "../order-comment/order-comment.schema.js"
import { CreateOrderHistoryDTO } from "../order-history/order-history.schema.js"
import { CreateOrderItemStockDTO } from "../order-item-stock/order-item-stock.schema.js"
import {
  CreateOrderRelocationRequestSchema,
  CreateOrderRelocationDTO,
  OrderRelocationEntityDTO,
} from "./order-relocation.schema.js"
import { OrderPublisher } from "../order/order.publisher.js"
import { NOTIFICATION_MEDIA } from "@smile/lib/rabbitmq/notification.js"
import { ENTITY_TAG, ENTITY_TYPE } from "@/common/constants/entity.js"
import { generateEventCode } from "@smile/lib/utils.js"
import { NotificationTypeRepository } from "@/common/repository/notification-type.js"

export class OrderRelocationModule {
  constructor(
    private readonly repo: OrderRelocationRepository,
    private readonly orderCommentRepo: OrderCommentRepository,
    private readonly orderItemStockRepo: OrderItemStockRepository,
    private readonly orderAuditRepo: OrderAuditRepository,
    private readonly orderHistoryRepo: OrderHistoryRepository,
    private readonly publisher: OrderPublisher,
    private readonly notificationTypeRepo: NotificationTypeRepository
  ) {}

  async create(c: Context, body: CreateOrderRelocationRequestSchema) {
    const { order_items, order_comment, required_date, ...createBody } = body
    const userId = Number(c.var.userId)
    const deviceType = DEVICE_TYPE[`${c.req.header("Device-Type")}`]

    const vendorParentEntity = await this.getParentVendorEntity(
      c,
      createBody.vendor_id,
      c.get("programId")
    )

    const [userVendorParents, userVendors, userCustomers] = await Promise.all([
      vendorParentEntity && vendorParentEntity.length > 0
        ? this.getListUserParentVendor(c, vendorParentEntity)
        : Promise.resolve(null),
      this.repo.getWsUsersByEntityId(
        c,
        createBody.vendor_id,
        c.get("programId")
      ),
      this.repo.getWsUsersByEntityId(
        c,
        createBody.customer_id,
        c.get("programId")
      ),
    ])

    const { users, customer, vendor } = await this.setUserNotification(
      c,
      Number(createBody.customer_id),
      Number(createBody.vendor_id),
      userCustomers,
      userVendors
    )

    const parentUsers = userVendorParents
      ? await this.setParentUserNotification(
          c,
          vendorParentEntity,
          userVendorParents
        )
      : undefined

    // Create Order
    const orderData: CreateOrderRelocationDTO = {
      ...createBody,
      is_allocated: IS_ALLOCATED.TRUE,
      order_type_id: ORDER_TYPE.RELOCATION,
      device_type: deviceType,
      order_status_id: ORDER_STATUS.PENDING,
      total_order_items: order_items.length,
      created_by: userId,
      updated_by: userId,
    }

    const createdOrder = await this.repo.create(c, orderData)
    const createdOrderId = Number(createdOrder.insertId)

    // Create Order Comment
    if (order_comment) {
      const orderCommentData: CreateOrderCommentDTO = {
        order_id: createdOrderId,
        user_id: userId,
        order_status_id: ORDER_STATUS.PENDING,
        comment: order_comment,
      }

      await this.orderCommentRepo.create(c, orderCommentData)
    }

    // Create Order Audit
    const orderAuditData: CreateOrderAuditDTO = {
      order_id: createdOrderId,
      required_date: required_date,
    }

    await this.orderAuditRepo.create(c, orderAuditData)

    // Create Order History
    const orderHistoryData: CreateOrderHistoryDTO = {
      order_id: createdOrderId,
      order_status_id: ORDER_STATUS.PENDING,
      created_by: userId,
      updated_by: userId,
    }

    await this.orderHistoryRepo.create(c, orderHistoryData)

    const orderItemsData: CreateOrderItemStockDTO[] = order_items.map(
      (orderItem) => ({
        ...orderItem,
        order_id: createdOrderId,
        qty: orderItem.ordered_qty,
        created_by: userId,
        updated_by: userId,
      })
    )

    const firstOrderItemsData = await this.getFirstOrderItemsData(
      c,
      c.get("programId"),
      orderItemsData
    )

    for (const orderItem of orderItemsData) {
      const { other_reason, children, ...orderItemData } = orderItem

      const createdOrderItem = await this.orderItemStockRepo.create(
        c,
        orderItemData
      )

      if (
        other_reason &&
        orderItemData.order_reason_id === ORDER_REASON.OTHERS
      ) {
        const orderOtherReason = {
          source_id: Number(createdOrderItem.insertId),
          source_type: "order_item",
          content: other_reason,
          created_at: new Date(),
          updated_at: new Date(),
        }
        await this.repo.createOtherReason(c, orderOtherReason)
      }

      if (children && children.length > 0) {
        for (const child of children) {
          const childData = {
            order_id: createdOrderId,
            parent_material_id: orderItemData.material_id,
            qty: child.ordered_qty,
            updated_by: userId,
            ...child,
          }
          await this.orderItemStockRepo.create(c, childData)
        }
      }
    }

    if (firstOrderItemsData)
      await this.pushOrderToNotification(
        c,
        createdOrderId,
        customer,
        vendor,
        firstOrderItemsData,
        users,
        parentUsers
      )

    await this.publisher.processCreate(c, createdOrderId, {
      ...body,
      is_allocated: IS_ALLOCATED.TRUE,
    })

    return { createdOrderId }
  }

  private async setNotificationData(
    c: Context,
    orderId: number,
    materialName: string,
    unitOfConsumption: string,
    relocationQty: number,
    customer: OrderRelocationEntityDTO,
    vendor: OrderRelocationEntityDTO,
    users,
    parentUsers
  ) {
    const titleData = this.setTitleNotification(orderId)
    const type = "order-relocation"
    const notifChannel =
      await this.notificationTypeRepo.generateNotificationChannels(c, type)

    const programId = c.get("programId")
    const eventCode = await generateEventCode()

    for (const user of users) {
      const messageData = this.setMessageNotification(
        orderId,
        materialName,
        unitOfConsumption,
        relocationQty,
        customer,
        vendor,
        user.entity.id
      )

      const payload = await this.setPayload(
        user,
        messageData.message,
        titleData,
        messageData.variables,
        type,
        programId,
        eventCode,
        vendor,
        false
      )

      for (const item of notifChannel) {
        if (
          (item.media === NOTIFICATION_MEDIA.WHATSAPP &&
            !payload.user.mobile_phone) ||
          (item.media === NOTIFICATION_MEDIA.FIREBASE &&
            !payload.user.fcm_token) ||
          (item.media === NOTIFICATION_MEDIA.EMAIL && !payload.user.email)
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

    if (parentUsers) {
      for (const parentUser of parentUsers) {
        const messageData = this.setMessageNotification(
          orderId,
          materialName,
          unitOfConsumption,
          relocationQty,
          customer,
          vendor,
          parentUser.entity.id,
          true
        )

        const payload = await this.setPayload(
          parentUser,
          messageData.message,
          titleData,
          messageData.variables,
          type,
          programId,
          eventCode,
          vendor,
          true
        )

        for (const item of notifChannel) {
          if (
            (item.media === NOTIFICATION_MEDIA.WHATSAPP &&
              !payload.user.mobile_phone) ||
            (item.media === NOTIFICATION_MEDIA.FIREBASE &&
              !payload.user.fcm_token) ||
            (item.media === NOTIFICATION_MEDIA.EMAIL && !payload.user.email)
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
  }

  private setMessageNotification(
    orderId: number,
    materialName: string,
    unitOfConsumption: string,
    relocationQty: number,
    customer: OrderRelocationEntityDTO,
    vendor: OrderRelocationEntityDTO,
    entityId: number,
    isParentUsers: boolean = false
  ) {
    const data = {
      order_id: orderId,
      material_name: materialName,
      unit_of_consumption: unitOfConsumption,
      vendor_name: vendor?.name,
      relocation_qty: relocationQty,
      customer_name: customer?.name,
    }

    const variables = [
      orderId,
      materialName,
      unitOfConsumption,
      relocationQty,
      customer?.name ?? "",
      vendor?.name ?? "",
    ]

    if (isParentUsers || entityId === customer?.id) {
      const jsonData = JSON.stringify(data)
      return {
        message: `notification.message.parent_order_relocation, ${jsonData}`,
        variables,
      }
    }

    const jsonData = JSON.stringify(data)
    return {
      message: `notification.message.order_relocation, ${jsonData}`,
      variables,
    }
  }

  private setTitleNotification(orderId: number) {
    const data = {
      order_id: orderId,
    }
    const jsonData = JSON.stringify(data)
    return `notification.title.order_relocation, ${jsonData}`
  }

  private async getParentVendorEntity(
    c: Context,
    vendorId: number,
    programId: number
  ) {
    const entity = await this.repo.getWsEntitiesById(c, vendorId, programId)

    let locationId: number | undefined = undefined
    let parentEntity: any | undefined = undefined
    const tagsCustomerToVendor = {
      3: ENTITY_TAG.CITY_DISTRICT_HEALTH_OFFICE,
      2: ENTITY_TAG.PROVINCE_HEALTH_OFFICE,
      1: ENTITY_TAG.MINISTRY_OF_HEALTH,
    }
    const tagVendor = entity ? (tagsCustomerToVendor[entity.type] ?? 0) : 0

    if (entity && entity.province_id && entity.type === ENTITY_TYPE.KOTA) {
      locationId = Number(entity.province_id)
    }

    if (entity && entity.regency_id && entity.type === ENTITY_TYPE.FASKES) {
      locationId = Number(entity.regency_id)
    }

    if (entity && tagVendor !== 0) {
      parentEntity = await this.repo.getWsEntitiesByLocationAndType(
        c,
        tagVendor,
        programId,
        entity.id,
        locationId
      )
    }

    return parentEntity
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

    let entitiesVendorCustomer: { id: number; name: string | null }[] = []
    if (uniqueEntityIds.length > 0) {
      entitiesVendorCustomer = await this.repo.getWsEntitiesByIds(
        c,
        uniqueEntityIds,
        c.get("programId")
      )
    }

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

    return { users: result, customer, vendor }
  }

  private async setParentUserNotification(
    c: Context,
    vendorParentEntity,
    userVendorParents
  ) {
    const result: unknown[] = []
    for (const vendor of vendorParentEntity) {
      userVendorParents.map((item) => {
        const newItem = { ...item }
        delete newItem.entity_id
        result.push({
          ...newItem,
          entity: vendor,
        })
      })
    }

    return result
  }

  private async getFirstOrderItemsData(
    c: Context,
    programId: number,
    orderItemsData
  ) {
    const materialIds = orderItemsData.map((item) => item.material_id)

    const materials = await this.repo.getWsMaterialByIds(
      c,
      materialIds,
      programId
    )

    const sorted = materials.sort((a, b) => a.name.localeCompare(b.name))

    const firstMaterial = sorted[0]

    const match = orderItemsData.find(
      (item) => item.material_id === firstMaterial?.id
    )

    const result = match
      ? {
          ...match,
          material_name: firstMaterial?.name,
          material_unit_of_consumption: firstMaterial?.unit_of_consumption,
        }
      : null

    return result
  }

  private async pushOrderToNotification(
    c: Context,
    orderId: number,
    customer: OrderRelocationEntityDTO,
    vendor: OrderRelocationEntityDTO,
    firstOrderItemsData,
    users,
    parentUsers
  ) {
    await this.setNotificationData(
      c,
      orderId,
      firstOrderItemsData.material_name,
      firstOrderItemsData.material_unit_of_consumption,
      firstOrderItemsData.ordered_qty,
      customer,
      vendor,
      users,
      parentUsers
    )

    return
  }

  private async setPayload(
    value,
    messageData: string,
    titleData: string,
    variables: (string | number)[],
    type: string,
    programId: number,
    eventCode: string,
    vendor: OrderRelocationEntityDTO,
    isParent: boolean
  ) {
    const entityId = value.entity.id
    let template = "order_relocation"
    if (isParent || entityId === vendor?.id)
      template = "parent_order_relocation"

    const payload = {
      event_code: eventCode,
      user: {
        user_id: value.id,
        email: value.email,
        mobile_phone: value.mobile_phone,
        fcm_token: value.fcm_token,
        entity_id: entityId,
        province_id: value.entity.province_id
          ? value.entity.province_id === ""
            ? null
            : value.entity.province_id
          : null,
        regency_id: value.entity.regency_id
          ? value.entity.regency_id === ""
            ? null
            : value.entity.regency_id
          : null,
      },
      user_entity_tag_id: value.entity.entity_tag_id,
      message: messageData,
      title: titleData,
      type: type,
      worker: "",
      workerMedia: "",
      program_id: programId,
      template,
      variables,
    }

    return payload
  }

  private async getListUserParentVendor(c: Context, listVendorParentEntity) {
    let result: unknown[] = []
    for (const item of listVendorParentEntity) {
      const list = await this.repo.getWsUsersByEntityId(
        c,
        item.id,
        c.var.programId
      )

      result = result.concat(list)
    }

    return result.length > 0 ? result : null
  }
}
