import { SyncPublisher } from "@smile/lib/base/sync-publisher.js"
import { Publisher } from "@smile/lib/rabbitmq/publisher.js"
import { TOPIC } from "@smile/lib/rabbitmq/topic.js"
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
}
