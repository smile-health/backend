import { SyncPublisher } from "@smile-health/lib/base/sync-publisher.js"
import { Publisher } from "@smile-health/lib/rabbitmq/publisher.js"
import { TOPIC } from "@smile-health/lib/rabbitmq/topic.js"
import { Context } from "hono"
import { OrderCommentRepository } from "../order-comment/order-comment.repository.js"
import { OrderItemStockRepository } from "../order-item-stock/order-item-stock.repository.js"
import { OrderRepository } from "./order.repository.js"
import { CreateOrderRequest } from "./order.schema.js"

export class OrderPublisher extends SyncPublisher {
  constructor(
    protected readonly publisher: Publisher,
    protected readonly repo: OrderRepository,
    protected readonly orderItemStockRepo: OrderItemStockRepository,
    protected readonly orderCommentRepo: OrderCommentRepository
  ) {
    super(publisher)
  }

  async processCreate(
    c: Context,
    orderId: number,
    req: CreateOrderRequest
  ): Promise<void> {
    const orderWorkspace = await this.repo.findOne(c, { id: orderId })
    const orderItemsWorkspace = await this.orderItemStockRepo.find(c, {
      order_id: orderId,
    })
    const orderCommentWorkspace = await this.orderCommentRepo.findOne(c, {
      order_id: orderId,
    })

    if (orderWorkspace) {
      const payload = {
        ...req,
        ...orderWorkspace,
        order_items: orderItemsWorkspace,
        order_comment_id: orderCommentWorkspace?.id,
        program_id: c.get("programId"),
      }

      const message = {
        headers: c.req.header(),
        payload: payload,
      }

      c.addEvent(TOPIC.ORDER_CREATED, message)
    }
  }

  async processRetryIntegrationLog(c: Context, data) {
    switch (data.client_key) {
      case "din": {
        const message = {
          headers: c.req.header(),
          payload: {
            ...data,
            order_id: data.order_id,
            program_id: data.program_id,
            retry: true,
          },
          user: c.var.user,
        }

        if (data.tag === "cancel_order") {
          c.addEvent(TOPIC.ORDER_STATUS_ORDER_CANCEL, message)
        } else if (data.tag === "receive_order") {
          c.addEvent(TOPIC.ORDER_STATUS_ORDER_FULFILLED, message)
        }
        break
      }
      default: {
        const message = {
          headers: c.req.header(),
          payload: {
            ...data,
            order_id: data.order_id,
            program_id: data.program_id,
            retry: true,
          },
          user: c.var.user,
        }

        if (data.tag === "validate_order") {
          c.addEvent(TOPIC.ORDER_STATUS_ORDER_VALIDATED, message)
        } else if (data.tag === "cancel_order") {
          c.addEvent(TOPIC.ORDER_STATUS_ORDER_CANCEL, message)
        }
        break
      }
    }
  }

  async processNotification(c: Context, payload) {
    payload.messageTranslation = this.publisher.setMessage(c, payload.message)
    payload.titleTranslation = this.publisher.setMessage(c, payload.title)
    await this.publisher.publishNotification(c, payload.worker, payload)
  }
}
