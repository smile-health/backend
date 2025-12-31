import { ORDER_STATUS } from "@/common/constants/order.js"
import { BaseMiddleware } from "@smile/lib/base/middleware.js"
import { NotFoundError, ValidationError } from "@smile/lib/error.js"
import { Context } from "hono"
import { createMiddleware } from "hono/factory"
import { z } from "zod"
import { ActivityRepository } from "../../activity/activity.repository.js"
import { OrderStatusAllocateRepository } from "./order-status-allocate.repository.js"
import {
  ChangeOrderStatusAllocateRequest,
  ChangeOrderStatusAllocateRequestSchema,
} from "./order-status-allocate.schema.js"

export class OrderStatusAllocateMiddleware extends BaseMiddleware {
  constructor(
    private readonly repository: OrderStatusAllocateRepository,
    private readonly activityRepository: ActivityRepository
  ) {
    super()
  }

  readonly #itemsUpdateCannotBeEmpty = (
    c: Context,
    data: ChangeOrderStatusAllocateRequest
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
    if (statusId === ORDER_STATUS.ALLOCATED) {
      throw new ValidationError(
        c.var.t("validator.cannot_same_status", {
          field: c.var.t("order_status.label.order_status_id"),
        })
      )
    }
    if (statusId !== ORDER_STATUS.CONFIRMED) {
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
      } else if (statusId === ORDER_STATUS.PENDING) {
        throw new ValidationError(
          c.var.t("validator.not_yet_confirmed", {
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

  readonly #getOrderStockStatus = async (c: Context, id: number) => {
    const orderStockStatus = await this.repository.getOrderStockStatusById(
      c,
      Number(id)
    )
    return orderStockStatus
  }

  readonly #getActiveActivityListByCustomer = async (
    c: Context,
    customerId: number
  ) => {
    const activities = await this.repository.getActiveActivityListByCustomerId(
      c,
      Number(customerId),
      c.get("programId")
    )
    return activities
  }

  readonly #getActivity = async (c: Context, id: number) => {
    const activity = await this.activityRepository.findOne(c, {
      id: Number(id),
      program_id: c.get("programId"),
    })
    return activity
  }

  readonly #getMaterials = async (c: Context, globalIds: number[]) => {
    const materials = await this.repository.getMaterialByGlobalIds(
      c,
      globalIds,
      c.get("programId")
    )
    return materials
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

  readonly #allocationsCannotBeEmpty = (
    ctx: z.RefinementCtx,
    allocations,
    path: string | (string | number)[]
  ) => {
    const issuePath = typeof path === "string" ? [path] : path
    if (allocations.length === 0) {
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

  readonly #allocatedQtyCheck = (
    ctx: z.RefinementCtx,
    allocatedQty: number,
    stock,
    path: string | (string | number)[]
  ) => {
    const issuePath = typeof path === "string" ? [path] : path
    if (allocatedQty > stock.qty - stock.allocated_qty) {
      ctx.addIssue({
        path: issuePath,
        message: "validator.cannot_greater_than_available_stock",
        code: z.ZodIssueCode.custom,
      })
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

  readonly #activityNotExist = (
    ctx: z.RefinementCtx,
    activity,
    activityListByCustomer,
    path: string | (string | number)[]
  ) => {
    const issuePath = typeof path === "string" ? [path] : path
    if (!activity) {
      ctx.addIssue({
        path: issuePath,
        message: "validator.not_exist",
        code: z.ZodIssueCode.custom,
      })
    }
    if (activityListByCustomer.length === 0) {
      ctx.addIssue({
        path: issuePath,
        message: "validator.not_exist",
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

  readonly #sumAllocatedItemsQtyCheck = (c: Context, items) => {
    const sumAllocatedItemsQty = items
      .flatMap((item) => {
        const fromChildren =
          Array.isArray(item.children) && item.children.length > 0
            ? item.children
                .filter(
                  (child) =>
                    Array.isArray(child.allocations) &&
                    child.allocations.length > 0
                )
                .flatMap((child) => child.allocations)
            : []

        const fromDirect =
          Array.isArray(item.allocations) && item.allocations.length > 0
            ? item.allocations
            : []

        return [...fromChildren, ...fromDirect]
      })
      .filter((alloc) => alloc.allocated_qty > 0)
      .reduce((sum, alloc) => sum + alloc.allocated_qty, 0)

    if (sumAllocatedItemsQty === 0) {
      throw new ValidationError(
        c.var.t("validator.min_one", {
          field: c.var.t("order_item_stock.label.allocated_qty"),
        })
      )
    }
  }

  readonly #mustHaveChildren = (
    ctx: z.RefinementCtx,
    path: string | (string | number)[]
  ) => {
    const issuePath = typeof path === "string" ? [path] : path

    ctx.addIssue({
      path: issuePath,
      message: "validator.must_have_children",
      code: z.ZodIssueCode.custom,
    })
  }

  readonly #unmatchParentChildrenId = (
    ctx: z.RefinementCtx,
    childMaterialId: number,
    childMaterialIds: number[],
    path: string | (string | number)[]
  ) => {
    const issuePath = typeof path === "string" ? [path] : path

    if (!childMaterialIds.includes(childMaterialId)) {
      ctx.addIssue({
        path: issuePath,
        message: "validator.not_children_of_parent_item",
        code: z.ZodIssueCode.custom,
      })
    }
  }

  readonly #updateItemsCheck = async (
    c: Context,
    data: ChangeOrderStatusAllocateRequest,
    ctx: z.RefinementCtx
  ) => {
    this.#sumAllocatedItemsQtyCheck(c, data.order_items)
    const stockList: number[] = []
    const order = await this.#getOrder(c)
    for (const [index, item] of data.order_items.entries()) {
      await this.#processOrderItem(c, item, index, order, stockList, ctx)
    }
  }

  readonly #processOrderItem = async (
    c: Context,
    item: ChangeOrderStatusAllocateRequest,
    index: number,
    order: any,
    stockList: number[],
    ctx: z.RefinementCtx
  ) => {
    const itemOrder = await this.#getItemOrder(
      c,
      item.id,
      Number(c.req.param("id") ?? 0)
    )
    this.#itemOrderNotExist(ctx, itemOrder, ["order_items", index, "id"])
    const material = await this.#getMaterial(c, itemOrder.material_id)
    const materialRelations =
      await this.repository.getMaterialRelationByMaterialId(
        c,
        material!.global_id
      )

    if (
      materialRelations &&
      materialRelations.length > 0 &&
      (!item.children || item.children.length === 0) &&
      itemOrder!.confirmed_qty! > 0
    ) {
      this.#mustHaveChildren(ctx, ["order_items", index, "id"])
    }

    if (item.allocations && item.allocations.length > 0) {
      stockList.length = 0

      this.#allocationsCannotBeEmpty(ctx, item.allocations, [
        "order_items",
        index,
        "allocations",
      ])

      if (itemOrder) {
        await this.#processAllocations(
          c,
          item.allocations,
          index,
          order,
          material,
          stockList,
          ctx
        )
      }
    }

    if (item.children && item.children.length > 0) {
      for (const [subIndex, child] of item.children.entries()) {
        stockList.length = 0

        let childMaterial
        if (child.id) {
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
            childMaterial = await this.#getMaterial(
              c,
              itemChildrenOrder.material_id
            )
          }
        } else {
          const globalMaterialIds = materialRelations.map(
            (item) => item.child_material_id
          )

          const childMaterials = await this.#getMaterials(c, globalMaterialIds)

          const childMaterialIds = childMaterials.map((item) => item.id)

          this.#unmatchParentChildrenId(
            ctx,
            child.material_id,
            childMaterialIds,
            ["order_items", index, "children", subIndex, "material_id"]
          )

          childMaterial = await this.#getMaterial(c, child.material_id)
        }

        if (
          child.allocations &&
          child.allocations.length > 0 &&
          childMaterial
        ) {
          await this.#processAllocations(
            c,
            child.allocations,
            subIndex,
            order,
            childMaterial,
            stockList,
            ctx,
            index
          )
        }
      }
    }
  }

  readonly #processAllocations = async (
    c: Context,
    allocations: ChangeOrderStatusAllocateRequest["order_items"][number]["allocations"],
    index: number,
    order: any,
    material: any,
    stockList: number[],
    ctx: z.RefinementCtx,
    parentIndex: undefined | number = undefined
  ) => {
    for (const [subIndex, allocation] of allocations.entries()) {
      const stock = await this.#getStock(
        c,
        allocation.stock_id,
        order?.vendor_id ?? 0,
        material!.id,
        c.var.programId
      )

      if (parentIndex !== undefined) {
        this.#stockNotExist(ctx, stock, [
          "order_items",
          parentIndex,
          "children",
          index,
          "allocations",
          subIndex,
          "stock_id",
        ])
      } else {
        this.#stockNotExist(ctx, stock, [
          "order_items",
          index,
          "allocations",
          subIndex,
          "stock_id",
        ])
      }

      if (stock && parentIndex !== undefined) {
        await this.#validateStock(
          c,
          stock,
          allocation,
          index,
          subIndex,
          stockList,
          ctx,
          parentIndex
        )
      }

      if (stock && parentIndex === undefined) {
        await this.#validateStock(
          c,
          stock,
          allocation,
          index,
          subIndex,
          stockList,
          ctx
        )
      }

      if (allocation.order_stock_status_id) {
        const stockStatus = await this.#getOrderStockStatus(
          c,
          allocation.order_stock_status_id
        )
        if (parentIndex !== undefined) {
          this.#orderStockStatusNotExist(ctx, stockStatus, [
            "order_items",
            parentIndex,
            "children",
            index,
            "allocations",
            subIndex,
            "order_stock_status_id",
          ])
        } else {
          this.#orderStockStatusNotExist(ctx, stockStatus, [
            "order_items",
            index,
            "allocations",
            subIndex,
            "order_stock_status_id",
          ])
        }
      }
    }
  }

  readonly #validateStock = async (
    c: Context,
    stock: any,
    allocation: any,
    index: number,
    subIndex: number,
    stockList: number[],
    ctx: z.RefinementCtx,
    parentIndex: undefined | number = undefined
  ) => {
    const activity = await this.#getActivity(c, stock?.activity_id ?? 0)
    const activityListByCustomer = await this.#getActiveActivityListByCustomer(
      c,
      stock?.entity_id ?? 0
    )
    if (parentIndex !== undefined) {
      this.#activityNotExist(ctx, activity, activityListByCustomer, [
        "order_items",
        parentIndex,
        "children",
        index,
        "allocations",
        subIndex,
        "stock_activity_id",
      ])
      this.#allocatedQtyCheck(ctx, allocation.allocated_qty, stock, [
        "order_items",
        parentIndex,
        "children",
        index,
        "allocations",
        subIndex,
        "allocated_qty",
      ])
      this.#duplicateStockOnForm(ctx, stockList, allocation.stock_id, [
        "order_items",
        parentIndex,
        "children",
        index,
        "allocations",
        subIndex,
        "stock_id",
      ])
    } else {
      this.#activityNotExist(ctx, activity, activityListByCustomer, [
        "order_items",
        index,
        "allocations",
        subIndex,
        "stock_activity_id",
      ])
      this.#allocatedQtyCheck(ctx, allocation.allocated_qty, stock, [
        "order_items",
        index,
        "allocations",
        subIndex,
        "allocated_qty",
      ])
      this.#duplicateStockOnForm(ctx, stockList, allocation.stock_id, [
        "order_items",
        index,
        "allocations",
        subIndex,
        "stock_id",
      ])
    }
    if (!stockList.includes(allocation.stock_id)) {
      stockList.push(allocation.stock_id)
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
    return ChangeOrderStatusAllocateRequestSchema.superRefine(
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
