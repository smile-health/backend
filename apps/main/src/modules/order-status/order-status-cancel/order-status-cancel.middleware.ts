import { ORDER_CANCEL_REASON, ORDER_STATUS } from "@/common/constants/order.js"
import { BaseMiddleware } from "@smile-health/lib/base/middleware.js"
import { NotFoundError, ValidationError } from "@smile-health/lib/error.js"
import { Context } from "hono"
import { createMiddleware } from "hono/factory"
import { z } from "zod"
import { OrderStatusCancelRepository } from "./order-status-cancel.repository.js"
import { ChangeOrderStatusCancelRequestSchema } from "./order-status-cancel.schema.js"

export class OrderStatusCancelMiddleware extends BaseMiddleware {
  constructor(private readonly repository: OrderStatusCancelRepository) {
    super()
  }

  readonly #getOrder = async (c: Context) => {
    const id = c.req.param("id")
    const order = await this.repository.getOrderById(
      c,
      Number(id),
      c.get("programId")
    )
    return order
  }

  readonly #IdNotExistsOrHasDeleted = (c: Context, order) => {
    if (!order)
      throw new NotFoundError(
        c.var.t("validator.not_exist", {
          field: c.var.t("order_status.label.order_id"),
        })
      )
    if (order?.deleted_at)
      throw new ValidationError(
        c.var.t("validator.delete", {
          field: c.var.t("order_status.label.order_id"),
        })
      )
  }

  readonly #statusNotAllowed = (c: Context, statusId: number) => {
    if (statusId === ORDER_STATUS.CANCELED) {
      throw new ValidationError(
        c.var.t("validator.cannot_same_status", {
          field: c.var.t("order_status.label.order_status_id"),
        })
      )
    } else if (statusId === ORDER_STATUS.FULFILLED) {
      throw new ValidationError(
        c.var.t("validator.has_fulfilled", {
          field: c.var.t("order_status.label.order_status_id"),
        })
      )
    }
  }

  readonly #getOrderCancelReason = async (c: Context, id: number) => {
    const orderCancelReason = await this.repository.getOrderCancelReasonById(
      c,
      Number(id)
    )
    return orderCancelReason
  }

  readonly #orderReasonNotExist = (
    ctx: z.RefinementCtx,
    orderReason,
    path: string | (string | number)[]
  ) => {
    const issuePath = typeof path === "string" ? [path] : path
    if (!orderReason) {
      ctx.addIssue({
        path: issuePath,
        message: "validator.not_exist",
        code: z.ZodIssueCode.custom,
      })
    }
  }

  readonly #otherReasonCheck = (
    ctx: z.RefinementCtx,
    orderReason,
    itemRequest,
    path: string | (string | number)[]
  ) => {
    const issuePath = typeof path === "string" ? [path] : path
    if (
      orderReason &&
      orderReason.id === ORDER_CANCEL_REASON.OTHERS &&
      !itemRequest.other_reason
    ) {
      ctx.addIssue({
        path: issuePath,
        message: "validator.required",
        code: z.ZodIssueCode.custom,
      })
    }
    if (
      orderReason &&
      orderReason.id !== ORDER_CANCEL_REASON.OTHERS &&
      itemRequest.other_reason
    ) {
      ctx.addIssue({
        path: issuePath,
        message: "validator.not_required",
        code: z.ZodIssueCode.custom,
      })
    }
  }

  readonly #otherReasonCanNotExist = (
    ctx: z.RefinementCtx,
    itemRequest,
    path: string | (string | number)[]
  ) => {
    const issuePath = typeof path === "string" ? [path] : path
    if (!itemRequest.order_reason_id && itemRequest.other_reason) {
      ctx.addIssue({
        path: issuePath,
        message: "validator.not_required",
        code: z.ZodIssueCode.custom,
      })
    }
  }

  readonly #programIdNotMatch = (c: Context, order) => {
    if (order.program_id !== c.get("programId")) {
      throw new NotFoundError(
        c.var.t("validator.not_match", {
          field: c.var.t("order.label.program_id"),
        })
      )
    }
  }

  update = (c: Context) => {
    return ChangeOrderStatusCancelRequestSchema.superRefine(
      async (data, ctx) => {
        if (data.order_cancel_reason_id) {
          const orderCancelReason = await this.#getOrderCancelReason(
            c,
            data.order_cancel_reason_id
          )
          this.#orderReasonNotExist(ctx, orderCancelReason, [
            "order_cancel_reason_id",
          ])
          this.#otherReasonCheck(ctx, orderCancelReason, data, ["other_reason"])
        } else {
          this.#otherReasonCanNotExist(ctx, data, ["other_reason"])
        }
      }
    )
  }

  detailOrder = createMiddleware(async (c, next) => {
    const order = await this.#getOrder(c)
    this.#programIdNotMatch(c, order)
    this.#IdNotExistsOrHasDeleted(c, order)
    this.#statusNotAllowed(c, order!.order_status_id)
    await next()
  })
}
