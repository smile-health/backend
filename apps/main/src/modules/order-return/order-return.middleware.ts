import { BaseMiddleware } from "@smile-health/lib/base/middleware.js"
import { ValidationError } from "@smile-health/lib/error.js"
import { Context } from "hono"
import { z } from "zod"
import { OrderReturnRepository } from "./order-return.repository.js"
import {
  OrderReturnRequest,
  OrderReturnRequestSchema,
} from "./order-return.schema.js"

export class OrderReturnMiddleware extends BaseMiddleware {
  constructor(private readonly repository: OrderReturnRepository) {
    super()
  }

  readonly #itemsCreateCannotBeEmpty = (
    c: Context,
    data: OrderReturnRequest
  ) => {
    if (data.order_items.length === 0) {
      throw new ValidationError(
        c.var.t("validator.not_empty", {
          field: "Order Items",
        })
      )
    }
  }

  readonly #getEntity = async (c: Context, id: number) => {
    const entity = await this.repository.getEntityById(
      c,
      Number(id),
      c.get("programId")
    )
    return entity
  }

  readonly #getVendorListByCustomer = async (
    c: Context,
    customerId: number
  ) => {
    const vendors = await this.repository.getVendorListByCustomerId(
      c,
      Number(customerId),
      c.get("programId")
    )
    return vendors
  }

  readonly #getActivity = async (c: Context, id: number) => {
    const activity = await this.repository.getActivityById(
      c,
      Number(id),
      c.get("programId")
    )
    return activity
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

  readonly #getMaterial = async (c: Context, id: number) => {
    const material = await this.repository.getMaterialById(
      c,
      Number(id),
      c.get("programId")
    )
    return material
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

  readonly #entityNotExist = (
    ctx: z.RefinementCtx,
    entity,
    path: string | (string | number)[]
  ) => {
    const issuePath = typeof path === "string" ? [path] : path
    if (!entity) {
      ctx.addIssue({
        path: issuePath,
        message: "validator.not_exist",
        code: z.ZodIssueCode.custom,
      })
    }
  }

  readonly #vendorNotAllowed = (
    ctx: z.RefinementCtx,
    vendorId: number,
    vendorListByCustomer,
    path: string | (string | number)[]
  ) => {
    const issuePath = typeof path === "string" ? [path] : path
    if (vendorListByCustomer.length > 0) {
      const vendors = vendorListByCustomer.map((vendor) => vendor.id)
      if (!vendors.includes(vendorId)) {
        ctx.addIssue({
          path: issuePath,
          message: "validator.not_allowed",
          code: z.ZodIssueCode.custom,
        })
      }
    } else {
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
    if (!activity || activityListByCustomer.length === 0) {
      ctx.addIssue({
        path: issuePath,
        message: "validator.not_exist",
        code: z.ZodIssueCode.custom,
      })
    }
  }

  readonly #requiredDateCheck = (
    ctx: z.RefinementCtx,
    requiredDate: Date,
    path: string | (string | number)[]
  ) => {
    const issuePath = typeof path === "string" ? [path] : path
    const requiredDateConverted = new Date(
      requiredDate.setUTCHours(16, 59, 59, 0)
    )
    if (requiredDateConverted < new Date()) {
      ctx.addIssue({
        path: issuePath,
        message: "validator.cannot_less_than_current_date",
        code: z.ZodIssueCode.custom,
      })
    }
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

  readonly #stocksCannotBeEmpty = (
    ctx: z.RefinementCtx,
    stocks,
    path: string | (string | number)[]
  ) => {
    const issuePath = typeof path === "string" ? [path] : path
    if (stocks.length === 0) {
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
    material,
    path: string | (string | number)[]
  ) => {
    const issuePath = typeof path === "string" ? [path] : path
    const stockAllocatedQty = stock.allocated_qty ? stock.allocated_qty : 0
    const availableStock = stock.qty - stockAllocatedQty
    const isStockMultiples =
      allocatedQty % material.consumption_unit_per_distribution_unit
    if (availableStock <= 0) {
      ctx.addIssue({
        path: issuePath,
        message: "validator.not_allowed",
        code: z.ZodIssueCode.custom,
      })
    }
    if (isStockMultiples === 0) {
      if (allocatedQty > availableStock) {
        ctx.addIssue({
          path: issuePath,
          message: "validator.cannot_greater_than_available_stock",
          code: z.ZodIssueCode.custom,
        })
      }
    } else {
      ctx.addIssue({
        path: issuePath,
        message: "validator.not_multiples",
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

  readonly #createItemsCheck = async (
    c: Context,
    data,
    ctx: z.RefinementCtx
  ) => {
    const materialList: number[] = []
    const stockList: number[] = []

    const validateMaterial = async (index: number, item) => {
      const material = await this.#getMaterial(c, item.material_id)
      this.#materialNotExist(ctx, material, [
        "order_items",
        index,
        "material_id",
      ])
      this.#stocksCannotBeEmpty(ctx, item.stocks, [
        "order_items",
        index,
        "stocks",
      ])
      this.#duplicateMaterialOnForm(ctx, materialList, item.material_id, [
        "order_items",
        index,
        "material_id",
      ])
      return material
    }

    const validateStock = async (
      index: number,
      subIndex: number,
      itemStock,
      material
    ) => {
      const stock = await this.#getStock(
        c,
        itemStock.stock_id,
        data.vendor_id,
        material.id,
        c.get("programId")
      )
      this.#stockNotExist(ctx, stock, [
        `order_items.${index}.stocks`,
        subIndex,
        "stock_id",
      ])
      if (stock) {
        this.#duplicateStockOnForm(ctx, stockList, itemStock.stock_id, [
          `order_items.${index}.stocks`,
          subIndex,
          "stock_id",
        ])
        if (!stockList.includes(itemStock.stock_id)) {
          stockList.push(itemStock.stock_id)
        }
        this.#allocatedQtyCheck(ctx, itemStock.allocated_qty, stock, material, [
          `order_items.${index}.stocks`,
          subIndex,
          "allocated_qty",
        ])
        if (itemStock.order_stock_status_id) {
          const stockStatus = await this.#getOrderStockStatus(
            c,
            itemStock.order_stock_status_id
          )
          this.#orderStockStatusNotExist(ctx, stockStatus, [
            `order_items.${index}.stocks`,
            subIndex,
            "order_stock_status_id",
          ])
        }
      }
    }

    for (const [index, item] of data.order_items.entries()) {
      const material = await validateMaterial(index, item)
      if (material) {
        for (const [subIndex, itemStock] of item.stocks.entries()) {
          await validateStock(index, subIndex, itemStock, material)
        }
      }
      materialList.push(item.material_id)
    }
  }

  readonly #createOrderCheck = async (
    c: Context,
    data,
    ctx: z.RefinementCtx
  ) => {
    const customer = await this.#getEntity(c, data.customer_id)
    const vendor = await this.#getEntity(c, data.vendor_id)
    const vendorListByCustomer = await this.#getVendorListByCustomer(
      c,
      data.vendor_id
    )
    const activity = await this.#getActivity(c, data.activity_id)
    const activityListByCustomer = await this.#getActiveActivityListByCustomer(
      c,
      data.vendor_id
    )
    this.#entityNotExist(ctx, customer, ["customer_id"])
    this.#entityNotExist(ctx, vendor, ["vendor_id"])
    this.#vendorNotAllowed(ctx, data.customer_id, vendorListByCustomer, [
      "customer_id",
    ])
    this.#activityNotExist(ctx, activity, activityListByCustomer, [
      "activity_id",
    ])
    if (data.required_date) {
      this.#requiredDateCheck(ctx, data.required_date, ["required_date"])
    }
  }

  create = (c: Context) => {
    return OrderReturnRequestSchema.superRefine(async (data, ctx) => {
      this.#itemsCreateCannotBeEmpty(c, data)
      await this.#createOrderCheck(c, data, ctx)
      await this.#createItemsCheck(c, data, ctx)
    })
  }
}
