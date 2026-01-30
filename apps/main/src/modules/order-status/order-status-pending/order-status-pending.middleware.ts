import { ORDER_STATUS } from "@/common/constants/order.js"
import { BaseMiddleware } from "@smile-health/lib/base/middleware.js"
import { NotFoundError, ValidationError } from "@smile-health/lib/error.js"
import { Context } from "hono"
import { createMiddleware } from "hono/factory"
import { OrderStatusPendingRepository } from "./order-status-pending.repository.js"

export class OrderStatusPendingMiddleware extends BaseMiddleware {
  constructor(private readonly repository: OrderStatusPendingRepository) {
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
    if (statusId === ORDER_STATUS.PENDING) {
      throw new ValidationError(
        c.var.t("validator.cannot_same_status", {
          field: c.var.t("order_status.label.order_status_id"),
        })
      )
    } else if (statusId !== ORDER_STATUS.CONFIRMED) {
      if (statusId === ORDER_STATUS.FULFILLED) {
        throw new ValidationError(
          c.var.t("validator.has_fulfilled", {
            field: c.var.t("order_status.label.order_status_id"),
          })
        )
      } else if (statusId === ORDER_STATUS.CANCELED) {
        throw new ValidationError(
          c.var.t("validator.has_cancelled", {
            field: c.var.t("order_status.label.order_status_id"),
          })
        )
      } else {
        throw new ValidationError(
          c.var.t("validator.cannot_previous_state", {
            field: c.var.t("order_status.label.order_status_id"),
          })
        )
      }
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

  detailOrder = createMiddleware(async (c, next) => {
    const order = await this.#getOrder(c)
    this.#programIdNotMatch(c, order)
    this.#IdNotExistsOrHasDeleted(c, order)
    this.#statusNotAllowed(c, order!.order_status_id)
    await next()
  })
}
