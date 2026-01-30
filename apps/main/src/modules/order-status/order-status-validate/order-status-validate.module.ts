import { ORDER_STATUS } from "@/common/constants/order.js"
import { Publisher } from "@smile-health/lib/rabbitmq/publisher.js"
import { Context } from "hono"
import { OrderStatusValidateRepository } from "./order-status-validate.repository.js"
import {
  AddOrderCommentValidateDTO,
  AddOrderHistoryValidateDTO,
  ChangeOrderItemStockValidateRequest,
  ChangeOrderStatusValidateDTO,
  ChangeOrderStatusValidateRequest,
  UpdateOrderAuditValidateDTO,
} from "./order-status-validate.schema.js"
import { BadRequestError } from "@smile-health/lib/error.js"
import { OrderIntegrationWorker } from "@/modules/order-integration/order-integration.worker.js"

export class OrderStatusValidateModule {
  constructor(
    private readonly repository: OrderStatusValidateRepository,
    private readonly workerIntegration: OrderIntegrationWorker,
    private readonly publisher: Publisher
  ) {}

  async update(
    c: Context,
    orderId: number,
    body: ChangeOrderStatusValidateRequest
  ) {
    const { order_items, comment, letter_number } = body
    const user = c.var.user
    const userId = Number(c.var.userId)
    const promises: unknown[] = []

    const orderItemsData: ChangeOrderItemStockValidateRequest[] =
      order_items.map((orderItem) => ({
        ...orderItem,
        validated_qty: orderItem.validated_qty,
        updated_by: userId,
        updated_at: new Date(),
      }))

    for (const orderItem of orderItemsData) {
      const { id, children, ...orderItemData } = orderItem

      if (children && children.length > 0) {
        for (const child of children) {
          const { id, ...childData } = child
          const newChildData = {
            validated_qty: childData.validated_qty,
            updated_by: userId,
            updated_at: new Date(),
            ...childData,
          }
          promises.push(
            this.repository.updateOrderItemStockValidateByOrderItemId(
              c,
              id,
              newChildData
            )
          )
        }
      }

      promises.push(
        this.repository.updateOrderItemStockValidateByOrderItemId(
          c,
          id,
          orderItemData
        )
      )
    }

    const orderData: ChangeOrderStatusValidateDTO = {
      no_document: letter_number,
      order_status_id: ORDER_STATUS.PENDING,
      updated_by: userId,
      updated_at: new Date(),
    }

    const orderHistoryData: AddOrderHistoryValidateDTO = {
      order_id: orderId,
      order_status_id: ORDER_STATUS.PENDING,
      created_by: userId,
      updated_by: userId,
      created_at: new Date(),
      updated_at: new Date(),
    }

    const orderAuditData: UpdateOrderAuditValidateDTO = {
      validated_at: new Date(),
      updated_at: new Date(),
      validated_by: userId,
      updated_by: userId,
    }

    promises.push(this.repository.update(c, orderData, { id: orderId }))

    promises.push(
      this.repository.createOrderHistoryValidate(c, orderHistoryData)
    )

    promises.push(
      this.repository.updateOrderAuditValidateByOrderId(
        c,
        orderId,
        orderAuditData
      )
    )

    if (comment) {
      const orderCommentData: AddOrderCommentValidateDTO = {
        order_id: orderId,
        user_id: userId,
        order_status_id: ORDER_STATUS.PENDING,
        created_by: userId,
        updated_by: userId,
        created_at: new Date(),
        updated_at: new Date(),
        comment: comment,
      }
      promises.push(
        this.repository.createOrderCommentValidate(c, orderCommentData)
      )
    }

    await Promise.all(promises)

    if (user?.username === "bypass_integration") {
      return { message: "Order validated successfully (bypass integration)." }
    }

    const response = await this.workerIntegration.doRequest(c, "validate", {
      order_id: orderId,
      letter_number: body.letter_number,
      comment: body.comment,
    })

    if (!response || response.error) {
      throw new BadRequestError(c.var.t("order-validation.error.integration"))
    }

    const bodyResponse =
      typeof response?.body === "string"
        ? JSON.parse(response?.body)
        : response?.body

    if (bodyResponse && bodyResponse.status !== 200) {
      throw new BadRequestError(
        bodyResponse?.message ?? c.var.t("order-validation.error.integration")
      )
    }

    return response
  }
}
