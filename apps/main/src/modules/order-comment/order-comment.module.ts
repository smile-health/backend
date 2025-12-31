import { Context } from "hono"
import { OrderCommentRepository } from "../order-comment/order-comment.repository.js"
import {
  CreateOrderCommentDTO,
  CreateOrderCommentRequest,
} from "../order-comment/order-comment.schema.js"
import { OrderCommentPublisher } from "./order-comment.publisher.js"

export class OrderCommentModule {
  constructor(
    private readonly repository: OrderCommentRepository,
    private readonly publisher: OrderCommentPublisher
  ) {}

  async create(c: Context, orderId: number, body: CreateOrderCommentRequest) {
    const { comment } = body
    const userId = Number(c.var.userId)

    const orderDetail = await this.repository.getOrderById(
      c,
      orderId,
      c.get("programId")
    )

    const orderCommentData: CreateOrderCommentDTO = {
      order_id: orderId,
      user_id: userId,
      order_status_id: orderDetail!.order_status_id,
      comment: comment,
    }

    const orderComment = await this.repository.create(c, orderCommentData)
    const orderCommentId = Number(orderComment.insertId)
    const detail = await this.repository.findOne(c, { id: orderCommentId })
    await this.publisher.processCreate(c, {
      ...detail,
      program_id: c.get("programId"),
    })
  }
}
