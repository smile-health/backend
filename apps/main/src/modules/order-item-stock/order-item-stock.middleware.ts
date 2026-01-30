import { ORDER_REASON, ORDER_STATUS } from "@/common/constants/order.js"
import { BaseMiddleware } from "@smile-health/lib/base/middleware.js"
import { NotFoundError, ValidationError } from "@smile-health/lib/error.js"
import { Context } from "hono"
import { createMiddleware } from "hono/factory"
import { z } from "zod"
import { OrderItemStockRepository } from "./order-item-stock.repository.js"
import {
  AddOrderItemStockRequest,
  AddOrderItemStockRequestSchema,
  EditOrderItemStockRequest,
  EditOrderItemStockRequestSchema,
} from "./order-item-stock.schema.js"

export class OrderItemStockMiddleware extends BaseMiddleware {
  constructor(private readonly repository: OrderItemStockRepository) {
    super()
  }

  readonly #itemsCreateCannotBeEmpty = (
    c: Context,
    data: AddOrderItemStockRequest
  ) => {
    if (data.order_items.length === 0) {
      throw new ValidationError(
        c.var.t("validator.not_empty", {
          field: "Order Items",
        })
      )
    }
  }

  readonly #itemsUpdateCannotBeEmpty = (
    c: Context,
    data: EditOrderItemStockRequest
  ) => {
    if (data.order_items.length === 0) {
      throw new ValidationError(
        c.var.t("validator.not_empty", {
          field: "Order Items",
        })
      )
    }


    if (
      data.order_items.some((item) => {
        const isValid =
          Boolean(item.order_reason_id) || Boolean(item.other_reason)
        return !isValid
      })
    ) {
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
          field: c.var.t("order_item_stock.label.order_id"),
        })
      )
    if (order?.deleted_at)
      throw new ValidationError(
        c.var.t("validator.delete", {
          field: c.var.t("order_item_stock.label.order_id"),
        })
      )
  }

  readonly #statusNotAllowed = (c: Context, order) => {
    if (order?.order_status_id !== ORDER_STATUS.PENDING)
      throw new ValidationError(
        c.var.t("validator.not_allowed", {
          field: c.var.t("order_item_stock.label.order_status_id"),
        })
      )
  }

  readonly #getMaterial = async (c: Context, id: number) => {
    const material = await this.repository.getMaterialById(
      c,
      Number(id),
      c.get("programId")
    )
    return material
  }

  readonly #getMaterialLevel = async (c: Context, id: number) => {
    const materialLevel = await this.repository.getMaterialLevelById(
      c,
      Number(id)
    )
    return materialLevel
  }

  readonly #getOrderReason = async (c: Context, id: number) => {
    const orderReason = await this.repository.getOrderReasonById(c, Number(id))
    return orderReason
  }

  readonly #getItemMaterial = async (
    c: Context,
    orderId: number,
    materialId: number
  ) => {
    const itemMaterial = await this.repository.getItemMaterialByOrderMaterialId(
      c,
      Number(orderId),
      Number(materialId)
    )
    return itemMaterial
  }

  readonly #getItemOrder = async (c: Context, id: number, orderId: number) => {
    const itemOrder = await this.repository.getItemByItemOrderId(
      c,
      Number(id),
      Number(orderId)
    )
    return itemOrder
  }

  readonly #materialNotExist = (
    ctx: z.RefinementCtx,
    material,
    path: string | (string | number)[]
  ) => {
    const issuePath = typeof path === "string" ? [path] : path
    if (!material) {
      ctx.addIssue({
        path: issuePath,
        message: "validator.not_exist",
        code: z.ZodIssueCode.custom,
      })
    }
  }

  readonly #materialLevelNotExist = (
    ctx: z.RefinementCtx,
    materialLevel,
    path: string | (string | number)[]
  ) => {
    const issuePath = typeof path === "string" ? [path] : path
    if (!materialLevel) {
      ctx.addIssue({
        path: issuePath,
        message: "validator.not_exist",
        code: z.ZodIssueCode.custom,
      })
    }
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

  readonly #materialKfaUnmatch = (
    ctx: z.RefinementCtx,
    material,
    order_item_kfa_id: number,
    path: string | (string | number)[]
  ) => {
    const issuePath = typeof path === "string" ? [path] : path
    if (material && material.material_level_id !== order_item_kfa_id) {
      ctx.addIssue({
        path: issuePath,
        message: "validator.unmatch",
        code: z.ZodIssueCode.custom,
      })
    }
  }

  readonly #orderedQtyCheck = (
    ctx: z.RefinementCtx,
    orderedQty: number,
    material,
    path: string | (string | number)[]
  ) => {
    const issuePath = typeof path === "string" ? [path] : path
    if (
      material &&
      orderedQty % material.consumption_unit_per_distribution_unit !== 0
    ) {
      ctx.addIssue({
        path: issuePath,
        message: "validator.not_multiples",
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
      orderReason.id === ORDER_REASON.OTHERS &&
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
      orderReason.id !== ORDER_REASON.OTHERS &&
      itemRequest.other_reason
    ) {
      ctx.addIssue({
        path: issuePath,
        message: "validator.not_required",
        code: z.ZodIssueCode.custom,
      })
    }
  }

  readonly #itemMaterialAlreadyExist = (
    ctx: z.RefinementCtx,
    itemMaterial,
    path: string | (string | number)[]
  ) => {
    const issuePath = typeof path === "string" ? [path] : path
    if (itemMaterial) {
      ctx.addIssue({
        path: issuePath,
        message: "validator.exist",
        code: z.ZodIssueCode.custom,
      })
    }
  }

  readonly #duplicateMaterialOnForm = (
    ctx: z.RefinementCtx,
    materialList: number[],
    materialId: number,
    path: string | (string | number)[]
  ) => {
    const issuePath = typeof path === "string" ? [path] : path

    if (materialList.includes(materialId)) {
      ctx.addIssue({
        path: issuePath,
        message: "validator.duplicated",
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

  readonly #isParentAndChildrenMaterialExists = (
    c: Context,
    ctx: z.RefinementCtx,
    index: number,
    orderItem,
    childrenMaterials
  ) => {
    let childrenMaterialLevelIds
    if (childrenMaterials.length > 0) {
      childrenMaterialLevelIds = childrenMaterials.map((item) => item.id)
    }

    for (const [subIndex, item] of orderItem.children.entries()) {
      if (
        childrenMaterials.length === 0 ||
        !childrenMaterialLevelIds.includes(item.material_id)
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "validator.not_exist",
          path: ["order_items", index, "children", subIndex, "material_id"],
        })
      }
    }
  }

  readonly #childrenMaterialCannotDuplicate = (
    c: Context,
    ctx: z.RefinementCtx,
    index: number,
    orderItem
  ) => {
    const childrenMaterialIds = orderItem.children.map(
      (item) => item.material_id
    )

    const childrenDuplicate = childrenMaterialIds
      .filter(
        (id, i, arr) => arr.indexOf(id) !== i && arr.lastIndexOf(id) === i
      )
      .sort((a, b) => a - b)

    for (const [subIndex, item] of orderItem.children.entries()) {
      if (childrenDuplicate.includes(item.material_id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "validator.duplicated",
          path: ["order_items", index, "children", subIndex, "material_id"],
        })
      }
    }
  }

  readonly #isParentAndChildrenMaterialHasRelation = async (
    c: Context,
    ctx: z.RefinementCtx,
    index: number,
    parentMaterials,
    childrenMaterials
  ) => {
    if (parentMaterials.length > 0 && childrenMaterials.length > 0) {
      const parentMaterialGlobalId = parentMaterials[0]!.global_id!

      let childrenMaterialGlobalIds
      if (childrenMaterials.length > 0) {
        childrenMaterialGlobalIds = childrenMaterials.map(
          (item) => item.global_id
        )
      }

      const materialRelations =
        await this.repository.getMaterialRelationByMaterialId(
          c,
          parentMaterialGlobalId
        )

      if (materialRelations.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "validator.parent_material_have_no_relation",
          path: ["order_items", index, "material_id"],
        })
      } else {
        const fromMaterialIds = materialRelations.map(
          (item) => item.child_material_id
        )

        for (const [
          subIndex,
          childrenMaterialGlobalId,
        ] of childrenMaterialGlobalIds.entries()) {
          if (!fromMaterialIds.includes(childrenMaterialGlobalId)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: "validator.unmatch_relation_with_parent_material",
              path: ["order_items", index, "children", subIndex, "material_id"],
            })
          }
        }
      }
    }
  }

  readonly #IsCorrectMaterialLevel = (
    c: Context,
    ctx: z.RefinementCtx,
    index: number,
    parentMaterials,
    childrenMaterials
  ) => {
    if (parentMaterials.length > 0 && childrenMaterials.length > 0) {
      const parentLessThanChild = childrenMaterials.every(
        (item) =>
          parentMaterials[0]!.material_level_id! < item.material_level_id
      )

      if (!parentLessThanChild) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "validator.parent_material_level_must_be_less_than_children_material",
          path: ["order_items", index, "material_id"],
        })
      }

      for (const [subIndex, childrenMaterial] of childrenMaterials.entries()) {
        if (
          !childrenMaterial ||
          childrenMaterial.material_level_id <=
            parentMaterials[0]!.material_level_id!
        ) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message:
              "validator.children_material_level_must_be_greater_than_parent_material",
            path: ["order_items", index, "children", subIndex, "material_id"],
          })
        }
      }
    }
  }

  readonly #isTotalChildrenQtyMatchWithTotalParentQty = (
    c: Context,
    ctx: z.RefinementCtx,
    index: number,
    orderItem
  ) => {
    const sumChildrenMaterialQty: number = orderItem.children.reduce(
      (sum: number, item) => sum + item.ordered_qty,
      0
    )

    if (orderItem.ordered_qty !== sumChildrenMaterialQty) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "validator.unmatch_quantity_with_total_children_quantity",
        path: ["order_items", index, "ordered_qty"],
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

  readonly #itemChildrenMaterialAlreadyExist = async (
    c: Context,
    ctx: z.RefinementCtx,
    index: number,
    orderItem
  ) => {
    const childrenItems =
      await this.repository.getChildItemByOrderParentMaterialId(
        c,
        Number(c.req.param("id")),
        orderItem.material_id
      )

    const childrenItemIds = childrenItems.map((item) => item.material_id)

    for (const [subIndex, child] of orderItem.children.entries()) {
      if (childrenItemIds.includes(child.material_id)) {
        ctx.addIssue({
          path: ["order_items", index, "children", subIndex, "material_id"],
          message: "validator.exist",
          code: z.ZodIssueCode.custom,
        })
      }
    }
  }

  readonly #createItemsCheck = async (
    c: Context,
    data: AddOrderItemStockRequest,
    ctx: z.RefinementCtx
  ) => {
    const materialList = []
    for (const [index, item] of data.order_items.entries()) {
      const material = await this.#getMaterial(c, item.material_id)
      this.#materialNotExist(ctx, material, [
        "order_items",
        index,
        "material_id",
      ])
      this.#duplicateMaterialOnForm(ctx, materialList, item.material_id, [
        "order_items",
        index,
        "material_id",
      ])
      if (material) {
        this.#orderedQtyCheck(ctx, item.ordered_qty, material, [
          "order_items",
          index,
          "ordered_qty",
        ])
        const itemMaterial = await this.#getItemMaterial(
          c,
          Number(c.req.param("id")),
          item.material_id
        )
        this.#itemMaterialAlreadyExist(ctx, itemMaterial, [
          "order_items",
          index,
          "material_id",
        ])
      }
      if (item.order_reason_id) {
        const orderReason = await this.#getOrderReason(c, item.order_reason_id)
        this.#orderReasonNotExist(ctx, orderReason, [
          "order_items",
          index,
          "order_reason_id",
        ])
        this.#otherReasonCheck(ctx, orderReason, item, [
          "order_items",
          index,
          "other_reason",
        ])
      }
      if (item.order_item_kfa_id) {
        const materialLevel = await this.#getMaterialLevel(
          c,
          item.order_item_kfa_id
        )
        this.#materialLevelNotExist(ctx, materialLevel, [
          "order_items",
          index,
          "order_item_kfa_id",
        ])
        this.#materialKfaUnmatch(ctx, material, item.order_item_kfa_id, [
          "order_items",
          index,
          "order_item_kfa_id",
        ])
      }
      materialList.push(item.material_id)

      if (item.children && item.children.length > 0) {
        const programId = c.get("programId")

        const parentMaterials =
          await this.repository.getWsMaterialByMaterialIds(
            c,
            [Number(item.material_id)],
            Number(programId)
          )

        const listChildrenMaterialId = item.children.map(
          (item) => item.material_id
        )

        const childrenMaterials =
          await this.repository.getWsMaterialByMaterialIds(
            c,
            listChildrenMaterialId,
            Number(programId)
          )

        this.#isParentAndChildrenMaterialExists(
          c,
          ctx,
          index,
          item,
          childrenMaterials
        )
        this.#childrenMaterialCannotDuplicate(c, ctx, index, item)
        await this.#itemChildrenMaterialAlreadyExist(c, ctx, index, item)
        await this.#isParentAndChildrenMaterialHasRelation(
          c,
          ctx,
          index,
          parentMaterials,
          childrenMaterials
        )
        this.#IsCorrectMaterialLevel(
          c,
          ctx,
          index,
          parentMaterials,
          childrenMaterials
        )
        this.#isTotalChildrenQtyMatchWithTotalParentQty(c, ctx, index, item)
      }
    }
  }

  readonly #updateItemsCheck = async (
    c: Context,
    data: EditOrderItemStockRequest,
    ctx: z.RefinementCtx
  ) => {
    for (const [index, item] of data.order_items.entries()) {
      const itemOrder = await this.#getItemOrder(
        c,
        item.id,
        Number(c.req.param("id"))
      )
      this.#itemOrderNotExist(ctx, itemOrder, ["order_items", index, "id"])
      if (itemOrder) {
        const material = await this.#getMaterial(c, itemOrder.material_id)
        this.#orderedQtyCheck(ctx, item.ordered_qty, material, [
          "order_items",
          index,
          "ordered_qty",
        ])
      }
      if (item.order_reason_id) {
        const orderReason = await this.#getOrderReason(c, item.order_reason_id)
        this.#orderReasonNotExist(ctx, orderReason, [
          "order_items",
          index,
          "order_reason_id",
        ])
        this.#otherReasonCheck(ctx, orderReason, item, [
          "order_items",
          index,
          "other_reason",
        ])
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

  create = (c: Context) => {
    return AddOrderItemStockRequestSchema.superRefine(async (data, ctx) => {
      this.#itemsCreateCannotBeEmpty(c, data)
      await this.#createItemsCheck(c, data, ctx)
    })
  }

  update = (c: Context) => {
    return EditOrderItemStockRequestSchema.superRefine(async (data, ctx) => {
      this.#itemsUpdateCannotBeEmpty(c, data)
      await this.#updateItemsCheck(c, data, ctx)
    })
  }

  detailOrder = createMiddleware(async (c, next) => {
    const order = await this.#getOrder(c)
    this.#programIdNotMatch(c, order)
    this.#IdNotExistsOrHasDeleted(c, order)
    this.#statusNotAllowed(c, order)
    await next()
  })
}
