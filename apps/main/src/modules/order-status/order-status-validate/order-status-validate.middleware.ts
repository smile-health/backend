import { ORDER_STATUS } from "@/common/constants/order.js"
import { BaseMiddleware } from "@smile-health/lib/base/middleware.js"
import { NotFoundError, ValidationError } from "@smile-health/lib/error.js"
import { Context } from "hono"
import { createMiddleware } from "hono/factory"
import { z } from "zod"
import { OrderStatusValidateRepository } from "./order-status-validate.repository.js"
import {
  ChangeOrderStatusValidateRequest,
  ChangeOrderStatusValidateRequestSchema,
} from "./order-status-validate.schema.js"

export class OrderStatusValidateMiddleware extends BaseMiddleware {
  constructor(private readonly repository: OrderStatusValidateRepository) {
    super()
  }

  readonly #itemsUpdateCannotBeEmpty = (
    c: Context,
    data: ChangeOrderStatusValidateRequest
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
    if (statusId !== ORDER_STATUS.DRAFT) {
      throw new ValidationError(
        c.var.t("validator.order_status", {
          field: c.var.t("order.label.draft"),
        })
      )
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

  readonly #getMaterials = async (c: Context, globalIds: number[]) => {
    const materials = await this.repository.getMaterialByGlobalIds(
      c,
      globalIds,
      c.get("programId")
    )
    return materials
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
    entityId: number,
    programId: number,
    materialId: number
  ) => {
    const stocks = await this.repository.getStockCustomerVendorByWsMaterialIds(
      c,
      Number(entityId),
      Number(programId),
      Number(materialId)
    )
    return stocks
  }

  readonly #getStockHierarchy = async (
    c: Context,
    entityId: number,
    programId: number,
    materialIds: number[]
  ) => {
    const stocks =
      await this.repository.getStockCustomerVendorHierarchyByWsMaterialIds(
        c,
        Number(entityId),
        Number(programId),
        materialIds
      )
    return stocks
  }

  readonly #confirmedQtyCheck = (
    ctx: z.RefinementCtx,
    confirmedQty: number,
    stocks,
    material,
    path: string | (string | number)[]
  ) => {
    const issuePath = typeof path === "string" ? [path] : path
    if (stocks[0].total_available_qty === 0 && confirmedQty !== 0) {
      ctx.addIssue({
        path: issuePath,
        message: "validator.must_be_zero",
        code: z.ZodIssueCode.custom,
      })
    }
    if (
      material &&
      confirmedQty % material.consumption_unit_per_distribution_unit !== 0
    ) {
      ctx.addIssue({
        path: issuePath,
        message: "validator.not_multiples",
        code: z.ZodIssueCode.custom,
      })
    }
    if (confirmedQty > stocks[0].total_available_qty) {
      ctx.addIssue({
        path: issuePath,
        message: "validator.cannot_greater_than_available_stock",
        code: z.ZodIssueCode.custom,
      })
    }
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

  readonly #isTotalChildrenQtyMatchWithTotalParentQty = (
    c: Context,
    ctx: z.RefinementCtx,
    index: number,
    orderItem
  ) => {
    const sumChildrenMaterialQty: number = orderItem.children.reduce(
      (sum: number, item) => sum + item.qty,
      0
    )

    if (orderItem.qty !== sumChildrenMaterialQty) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "validator.unmatch_quantity_with_total_children_quantity",
        path: ["order_items", index, "qty"],
      })
    }
  }

  readonly #itemChildrenOrderNotExist = async (
    c: Context,
    ctx: z.RefinementCtx,
    index: number,
    orderItem
  ) => {
    for (const [subIndex, child] of orderItem.children.entries()) {
      const childItem = await this.#getItemOrder(
        c,
        child.id,
        Number(c.req.param("id"))
      )

      if (!childItem) {
        ctx.addIssue({
          path: ["order_items", index, "children", subIndex, "id"],
          message: "validator.not_exist",
          code: z.ZodIssueCode.custom,
        })
      }
    }
  }

  readonly #unmatchParentChildrenId = async (
    c: Context,
    ctx: z.RefinementCtx,
    index: number,
    orderItem,
    parentMaterialId: number
  ) => {
    const childrenItems =
      await this.repository.getChildItemByOrderParentMaterialId(
        c,
        Number(c.req.param("id")),
        parentMaterialId
      )

    const childrenItemIds = childrenItems.map((item) => item.id)

    for (const [subIndex, child] of orderItem.children.entries()) {
      if (!childrenItemIds.includes(child.id)) {
        ctx.addIssue({
          path: ["order_items", index, "children", subIndex, "id"],
          message: "validator.not_children_of_parent_item",
          code: z.ZodIssueCode.custom,
        })
      }
    }
  }

  readonly #updateItemsCheck = async (
    c: Context,
    data: ChangeOrderStatusValidateRequest,
    ctx: z.RefinementCtx
  ) => {
    const order = await this.#getOrder(c)
    for (const [index, item] of data.order_items.entries()) {
      const itemOrder = await this.#getItemOrder(
        c,
        item.id,
        Number(c.req.param("id") ?? 0)
      )
      this.#itemOrderNotExist(ctx, itemOrder, ["order_items", index, "id"])
      if (itemOrder) {
        const material = await this.#getMaterial(c, itemOrder.material_id)
        const materialRelations =
          await this.repository.getMaterialRelationByMaterialId(
            c,
            material!.global_id
          )
        let stocks
        if (!materialRelations || materialRelations.length === 0) {
          stocks = await this.#getStock(
            c,
            order!.vendor_id,
            c.get("programId"),
            material!.id
          )
        } else {
          const globalMaterialIds = materialRelations.map(
            (item) => item.child_material_id
          )
          const materials = await this.#getMaterials(c, globalMaterialIds)
          const materialIds = materials.map((item) => item.id)
          stocks = await this.#getStockHierarchy(
            c,
            order!.vendor_id,
            c.get("programId"),
            materialIds
          )
        }
      }

      if (item.children && item.children.length > 0) {
        await this.#itemChildrenOrderNotExist(c, ctx, index, item)

        if (itemOrder) {
          await this.#unmatchParentChildrenId(
            c,
            ctx,
            index,
            item,
            itemOrder.material_id
          )
        }

        this.#isTotalChildrenQtyMatchWithTotalParentQty(c, ctx, index, item)

        for (const [subIndex, child] of item.children.entries()) {
          const itemChildrenOrder = await this.#getItemOrder(
            c,
            child.id,
            Number(c.req.param("id") ?? 0)
          )
          const material = await this.#getMaterial(
            c,
            itemChildrenOrder.material_id
          )
          const stocks = await this.#getStock(
            c,
            order!.vendor_id,
            c.get("programId"),
            material!.id
          )
          if (stocks && stocks.length > 0) {
            this.#confirmedQtyCheck(
              ctx,
              child.validated_qty,
              stocks,
              material,
              ["order_items", index, "children", subIndex, "validated_qty"]
            )
          }
        }
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

  update = (c: Context) => {
    return ChangeOrderStatusValidateRequestSchema.superRefine(
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
