import { ORDER_STATUS } from "@/common/constants/order.js"
import { BaseMiddleware } from "@smile-health/lib/base/middleware.js"
import { NotFoundError, ValidationError } from "@smile-health/lib/error.js"
import { Context } from "hono"
import { createMiddleware } from "hono/factory"
import { z } from "zod"
import { OrderStatusFulfilledRepository } from "./order-status-fulfilled.repository.js"
import {
  ChangeOrderStatusFulfilledRequest,
  ChangeOrderStatusFulfilledRequestSchema,
} from "./order-status-fulfilled.schema.js"
import moment from "moment"

export class OrderStatusFulfilledMiddleware extends BaseMiddleware {
  constructor(private readonly repository: OrderStatusFulfilledRepository) {
    super()
  }

  readonly #itemsUpdateCannotBeEmpty = (
    c: Context,
    data: ChangeOrderStatusFulfilledRequest
  ) => {
    if (data.order_items.length === 0) {
      throw new ValidationError(
        c.var.t("validator.not_empty", {
          field: "Order Items",
        })
      )
    }
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
    if (statusId === ORDER_STATUS.FULFILLED) {
      throw new ValidationError(
        c.var.t("validator.cannot_same_status", {
          field: c.var.t("order_status.label.order_status_id"),
        })
      )
    } else if (statusId !== ORDER_STATUS.SHIPPED) {
      if (statusId === ORDER_STATUS.CANCELED) {
        throw new ValidationError(
          c.var.t("validator.has_cancelled", {
            field: c.var.t("order_status.label.order_status_id"),
          })
        )
      } else {
        throw new ValidationError(
          c.var.t("validator.not_yet_shipped", {
            field: c.var.t("order_status.label.order_status_id"),
          })
        )
      }
    }
  }

  readonly #getMaterial = async (c: Context, id: number) => {
    const material = await this.repository.getMaterialById(
      c,
      Number(id),
      c.get("programId")
    )
    return material
  }

  readonly #getItemOrder = async (c: Context, id: number, orderId: number) => {
    const itemOrder = await this.repository.getItemByItemOrderId(
      c,
      Number(id),
      Number(orderId)
    )
    return itemOrder
  }

  readonly #getStock = async (
    c: Context,
    id: number,
    entityId: number,
    materialId: number,
    programId: number
  ) => {
    const stock = await this.repository.getStockVendorById(
      c,
      Number(id),
      Number(entityId),
      Number(materialId),
      Number(programId)
    )
    return stock
  }

  readonly #getOrderAudit = async (c: Context, orderId: number) => {
    const orderAudit = await this.repository.getOrderAuditByOrderId(
      c,
      Number(orderId)
    )
    return orderAudit
  }

  readonly #getOrderStockStatus = async (c: Context, id: number) => {
    const orderStockStatus = await this.repository.getOrderStockStatusById(
      c,
      Number(id)
    )
    return orderStockStatus
  }

  readonly #getOrderStock = async (
    c: Context,
    orderId: number,
    stockId: number
  ) => {
    const orderStock = await this.repository.getOrderItemStockByStockId(
      c,
      Number(orderId),
      Number(stockId)
    )
    return orderStock
  }

  readonly #itemOrderNotExist = (
    ctx: z.RefinementCtx,
    itemOrder,
    path: string | (string | number)[]
  ) => {
    const issuePath = typeof path === "string" ? [path] : path
    if (!itemOrder) {
      ctx.addIssue({
        path: issuePath,
        message: "validator.not_exist",
        code: z.ZodIssueCode.custom,
      })
    }
  }

  readonly #receivesCannotBeEmpty = (
    ctx: z.RefinementCtx,
    receives,
    path: string | (string | number)[]
  ) => {
    const issuePath = typeof path === "string" ? [path] : path
    if (receives.length === 0) {
      ctx.addIssue({
        path: issuePath,
        message: "validator.not_empty",
        code: z.ZodIssueCode.custom,
      })
    }
  }

  readonly #stockNotExist = (
    ctx: z.RefinementCtx,
    stock,
    path: string | (string | number)[]
  ) => {
    const issuePath = typeof path === "string" ? [path] : path
    if (!stock) {
      ctx.addIssue({
        path: issuePath,
        message: "validator.not_exist",
        code: z.ZodIssueCode.custom,
      })
    }
  }

  readonly #receiveQtyCheck = (
    ctx: z.RefinementCtx,
    receiveQty: number,
    allocatedQty: number,
    path: string | (string | number)[]
  ) => {
    const issuePath = typeof path === "string" ? [path] : path
    if (receiveQty !== allocatedQty) {
      ctx.addIssue({
        path: issuePath,
        message: "validator.same_value_shipment_quantity",
        code: z.ZodIssueCode.custom,
      })
    }
  }

  readonly #fulfilledDateCheck = (
    c: Context,
    ctx: z.RefinementCtx,
    fulfilledDate: Date,
    path: string | (string | number)[]
  ) => {
    const issuePath = typeof path === "string" ? [path] : path
    const timezone = c.req.header("Timezone")
    const convertedFulfilledDate = new Date(
      moment.tz(fulfilledDate, timezone).startOf("day").toISOString()
    )
    const currentDate = new Date(
      moment.tz(timezone).startOf("day").toISOString()
    )
    if (convertedFulfilledDate > currentDate) {
      ctx.addIssue({
        path: issuePath,
        message: "validator.cannot_greater_than_current_date",
        code: z.ZodIssueCode.custom,
      })
    }
  }

  readonly #duplicateStockOnForm = (
    ctx: z.RefinementCtx,
    stockList: number[],
    stockId: number,
    path: string | (string | number)[]
  ) => {
    const issuePath = typeof path === "string" ? [path] : path

    if (stockList.includes(stockId)) {
      ctx.addIssue({
        path: issuePath,
        message: "validator.duplicated",
        code: z.ZodIssueCode.custom,
      })
    }
  }

  readonly #sumReceivedItemsQtyCheck = (c: Context, items) => {
    const sumReceivedItemsQty = items
      .flatMap((item) => {
        const fromChildren =
          Array.isArray(item.children) && item.children.length > 0
            ? item.children
                .filter(
                  (child) =>
                    Array.isArray(child.receives) && child.receives.length > 0
                )
                .flatMap((child) => child.receives)
            : []

        const fromDirect =
          Array.isArray(item.receives) && item.receives.length > 0
            ? item.receives
            : []

        return [...fromChildren, ...fromDirect]
      })
      .filter((alloc) => alloc.received_qty > 0)
      .reduce((sum, rec) => sum + rec.received_qty, 0)

    if (sumReceivedItemsQty === 0) {
      throw new ValidationError(
        c.var.t("validator.min_one", {
          field: c.var.t("order_item_stock.label.received_qty"),
        })
      )
    }
  }

  readonly #orderStockStatusNotExist = (
    ctx: z.RefinementCtx,
    stockStatus,
    path: string | (string | number)[]
  ) => {
    const issuePath = typeof path === "string" ? [path] : path
    if (!stockStatus) {
      ctx.addIssue({
        path: issuePath,
        message: "validator.not_exist",
        code: z.ZodIssueCode.custom,
      })
    }
  }

  readonly #fulfillStockStatusIdNotRequired = (
    ctx: z.RefinementCtx,
    path: string | (string | number)[]
  ) => {
    const issuePath = typeof path === "string" ? [path] : path
    ctx.addIssue({
      path: issuePath,
      message: "validator.not_required",
      code: z.ZodIssueCode.custom,
    })
  }

  readonly #updateItemsCheck = async (
    c: Context,
    data: ChangeOrderStatusFulfilledRequest,
    ctx: z.RefinementCtx
  ) => {
    this.#sumReceivedItemsQtyCheck(c, data.order_items)
    const stockList: number[] = []
    const order = await this.#getOrder(c)
    const orderAudit = await this.#getOrderAudit(c, c.req.param("id"))
    for (const [index, item] of data.order_items.entries()) {
      const itemOrder = await this.#getItemOrder(c, item.id, c.req.param("id"))
      this.#itemOrderNotExist(ctx, itemOrder, ["order_items", index, "id"])

      if (item.receives && item.receives.length > 0) {
        this.#receivesCannotBeEmpty(ctx, item.receives, [
          "order_items",
          index,
          "receives",
        ])

        if (itemOrder) {
          const material = await this.#getMaterial(c, itemOrder.material_id)
          for (const [subIndex, receive] of item.receives.entries()) {
            const stock = await this.#getStock(
              c,
              receive.stock_id,
              order!.vendor_id,
              material!.id,
              c.get("programId")
            )
            this.#stockNotExist(ctx, stock, [
              "order_items",
              index,
              "receives",
              subIndex,
              "stock_id",
            ])
            if (stock) {
              this.#duplicateStockOnForm(ctx, stockList, receive.stock_id, [
                "order_items",
                index,
                "receives",
                subIndex,
                "stock_id",
              ])
              if (!stockList.includes(receive.stock_id)) {
                stockList.push(receive.stock_id)
              }
              const orderStock = await this.#getOrderStock(
                c,
                Number(c.req.param("id")),
                receive.stock_id
              )
              this.#receiveQtyCheck(
                ctx,
                receive.received_qty,
                orderStock!.allocated_qty!,
                ["order_items", index, "receives", subIndex, "received_qty"]
              )
            }
            if (receive.fulfill_stock_status_id) {
              if (material?.is_temperature_sensitive === 0) {
                this.#fulfillStockStatusIdNotRequired(ctx, [
                  "order_items",
                  index,
                  "receives",
                  subIndex,
                  "fulfill_stock_status_id",
                ])
              } else {
                const stockStatus = await this.#getOrderStockStatus(
                  c,
                  receive.fulfill_stock_status_id
                )
                this.#orderStockStatusNotExist(ctx, stockStatus, [
                  "order_items",
                  index,
                  "receives",
                  subIndex,
                  "fulfill_stock_status_id",
                ])
              }
            }
          }
        }
      }

      if (item.children && item.children.length > 0) {
        for (const [subIndex, child] of item.children.entries()) {
          const itemChildrenOrder = await this.#getItemOrder(
            c,
            child.id,
            Number(c.req.param("id") ?? 0)
          )
          this.#itemOrderNotExist(ctx, itemChildrenOrder, [
            "order_items",
            index,
            "children",
            subIndex,
            "id",
          ])
          if (itemChildrenOrder) {
            const childMaterial = await this.#getMaterial(
              c,
              itemChildrenOrder.material_id
            )

            if (childMaterial && child.receives && child.receives.length > 0) {
              for (const [childSubIndex, receive] of child.receives.entries()) {
                const stock = await this.#getStock(
                  c,
                  receive.stock_id,
                  order?.vendor_id ?? 0,
                  childMaterial!.id,
                  c.var.programId
                )
                this.#stockNotExist(ctx, stock, [
                  "order_items",
                  index,
                  "children",
                  subIndex,
                  "receives",
                  childSubIndex,
                  "stock_id",
                ])
                if (stock) {
                  this.#duplicateStockOnForm(ctx, stockList, receive.stock_id, [
                    "order_items",
                    index,
                    "children",
                    subIndex,
                    "receives",
                    childSubIndex,
                    "stock_id",
                  ])
                  if (!stockList.includes(receive.stock_id)) {
                    stockList.push(receive.stock_id)
                  }
                  const orderStock = await this.#getOrderStock(
                    c,
                    Number(c.req.param("id")),
                    receive.stock_id
                  )
                  this.#receiveQtyCheck(
                    ctx,
                    receive.received_qty,
                    orderStock!.allocated_qty!,
                    [
                      "order_items",
                      index,
                      "children",
                      subIndex,
                      "receives",
                      childSubIndex,
                      "received_qty",
                    ]
                  )
                }
                if (receive.fulfill_stock_status_id) {
                  if (childMaterial?.is_temperature_sensitive === 0) {
                    this.#fulfillStockStatusIdNotRequired(ctx, [
                      "order_items",
                      index,
                      "children",
                      subIndex,
                      "receives",
                      childSubIndex,
                      "fulfill_stock_status_id",
                    ])
                  } else {
                    const stockStatus = await this.#getOrderStockStatus(
                      c,
                      receive.fulfill_stock_status_id
                    )
                    this.#orderStockStatusNotExist(ctx, stockStatus, [
                      "order_items",
                      index,
                      "children",
                      subIndex,
                      "receives",
                      childSubIndex,
                      "fulfill_stock_status_id",
                    ])
                  }
                }
              }
            }
          }
        }
      }
    }
    this.#fulfilledDateCheck(c, ctx, data.fulfilled_at, ["fulfilled_at"])
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
    return ChangeOrderStatusFulfilledRequestSchema.superRefine(
      async (data, ctx) => {
        this.#itemsUpdateCannotBeEmpty(c, data)
        await this.#updateItemsCheck(c, data, ctx)
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
