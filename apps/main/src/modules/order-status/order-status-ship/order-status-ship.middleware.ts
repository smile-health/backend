import { ORDER_STATUS } from "@/common/constants/order.js"
import { BaseMiddleware } from "@smile/lib/base/middleware.js"
import { NotFoundError, ValidationError } from "@smile/lib/error.js"
import { Context } from "hono"
import { createMiddleware } from "hono/factory"
import { z } from "zod"
import { OrderStatusShipRepository } from "./order-status-ship.repository.js"
import { ChangeOrderStatusShipRequestSchema } from "./order-status-ship.schema.js"

export class OrderStatusShipMiddleware extends BaseMiddleware {
  constructor(private readonly repository: OrderStatusShipRepository) {
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
    if (statusId === ORDER_STATUS.SHIPPED) {
      throw new ValidationError(
        c.var.t("validator.cannot_same_status", {
          field: c.var.t("order_status.label.order_status_id"),
        })
      )
    } else if (statusId !== ORDER_STATUS.ALLOCATED) {
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
          c.var.t("validator.not_yet_allocated", {
            field: c.var.t("order_status.label.order_status_id"),
          })
        )
      }
    }
  }

  readonly #estimatedDateCheck = (
    ctx: z.RefinementCtx,
    estimatedDate: Date,
    actualShipmentDate: Date,
    path: string | (string | number)[]
  ) => {
    const issuePath = typeof path === "string" ? [path] : path
    if (estimatedDate && estimatedDate < actualShipmentDate) {
      ctx.addIssue({
        path: issuePath,
        message: "validator.cannot_less_than_actual_shipment_date",
        code: z.ZodIssueCode.custom,
      })
    }
  }

  readonly #takenByCustomerCheck = (
    ctx: z.RefinementCtx,
    takenByCustomer: number,
    path: string | (string | number)[]
  ) => {
    const issuePath = typeof path === "string" ? [path] : path
    if (takenByCustomer && ![0, 1].includes(takenByCustomer)) {
      ctx.addIssue({
        path: issuePath,
        message: "validator.only_one_zero",
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

  update = () => {
    return ChangeOrderStatusShipRequestSchema.superRefine((data, ctx) => {
      this.#estimatedDateCheck(
        ctx,
        data.estimated_date!,
        data.actual_shipment_date,
        ["estimated_date"]
      )
      this.#takenByCustomerCheck(ctx, data.taken_by_customer!, [
        "taken_by_customer",
      ])
    })
  }

  detailOrder = createMiddleware(async (c, next) => {
    const order = await this.#getOrder(c)
    this.#programIdNotMatch(c, order)
    this.#IdNotExistsOrHasDeleted(c, order)
    this.#statusNotAllowed(c, order!.order_status_id)
    await next()
  })
}
