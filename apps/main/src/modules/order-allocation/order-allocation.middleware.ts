import { STATUS } from "@/common/constants/material.js"
import { EntityRepository } from "@/modules/entity/entity.repository.js"
import { ValidationError } from "@smile/lib/error.js"
import { Context } from "hono"
import { createMiddleware } from "hono/factory"
import { toString } from "lodash"
import moment from "moment"
import { z } from "zod"
import { ActivityRepository } from "../activity/activity.repository.js"
import { EntityVendorRepository } from "../entity-vendor/entity-vendor.repository.js"
import { MaterialRepository } from "../material/material.repository.js"
import { OrderAllocationRepository } from "./order-allocation.repository.js"
import {
  CreateOrderAllocationRequest,
  CreateOrderAllocationSchema,
  ListCheckStockSchema,
  ListEntityArraySchema,
  WSActivitySchema,
  WSMaterialSchema,
} from "./order-allocation.schema.js"

interface Indexes {
  orderIndex: string
  stockIndex: string
}

interface StockIdentifiers {
  stock_id: number
  activity_id: number
  material_id: number
}

export class OrderAllocationMiddleware {
  constructor(
    private readonly entityRepo: EntityRepository,
    private readonly entityVendorRepository: EntityVendorRepository,
    private readonly materialRepo: MaterialRepository,
    private readonly orderAllocationRepo: OrderAllocationRepository,
    private readonly activityRepo: ActivityRepository
  ) {}

  validateDateRange = createMiddleware(async (c, next) => {
    const { from_date, to_date } = c.req.query()
    if (from_date && to_date && moment(from_date).isAfter(moment(to_date))) {
      throw new ValidationError("Invalid Date Range")
    }

    await next()
  })

  createSchemaOrderAllocation = (c: Context) => {
    return CreateOrderAllocationSchema.superRefine(
      async (data: CreateOrderAllocationRequest, ctx: z.RefinementCtx) => {
        this.#isCustomerVendorNotTheSame(c, ctx, data)

        const materialIds = data.order_items.map((item) => item.material_id)
        const activityIds = [
          ...new Set([
            ...data.order_items.flatMap((item) =>
              item.stocks.map((stock) => stock.activity_id)
            ),
            data.activity_id,
          ]),
        ]
        const stockIds = [
          ...new Set(
            data.order_items.flatMap((item) =>
              item.stocks.map((stock) => stock.stock_id)
            )
          ),
        ]

        await this.#isCustomerBelongsToVendor(c, ctx, data)
        const [materialsExist, entitiesExist, activitiesExist, stocksExist] =
          await Promise.all([
            this.materialRepo.find(c, { id: materialIds }),
            this.entityRepo.find(c, { id: [data.customer_id, data.vendor_id] }),
            this.activityRepo.find(c, { id: activityIds }),
            this.orderAllocationRepo.getCheckStockByIds(
              c,
              stockIds,
              activityIds,
              c.get("programId"),
              data.vendor_id,
              materialIds
            ),
          ])

        this.#isVendorAndCustomerExist(
          c,
          ctx,
          entitiesExist,
          data.vendor_id,
          data.customer_id
        )
        this.#isMaterialAndStockDuplicate(c, ctx, data)
        if (data.required_date) this.#isRequiredDateSameOrAfter(c, ctx, data)
        this.#isActivityExist(ctx, activitiesExist, data.activity_id, [
          "activity_id",
        ])

        if (data.estimated_date) this.#isEstimatedDateSameOrAfter(c, ctx, data)

        for (const [orderIndex, orderItem] of data.order_items.entries()) {
          const { material_id, stocks } = orderItem

          const isMaterialExist = materialsExist.find(
            (m) => m.id === material_id
          )
          this.#isMaterialExist(c, ctx, orderIndex, isMaterialExist)

          this.#isMaterialActiveAndExist(
            c,
            ctx,
            material_id,
            orderIndex,
            materialsExist
          )

          await Promise.all(
            stocks.map(async (stockItem, stockIndex) => {
              await Promise.all([
                this.#isActivityExist(
                  ctx,
                  activitiesExist,
                  stockItem.activity_id,
                  [
                    "order_items",
                    orderIndex.toString(),
                    "stocks",
                    stockIndex.toString(),
                    "activity_id",
                  ]
                ),
                this.#isMatchedOrderStockStatusId(
                  c,
                  ctx,
                  stockItem.order_stock_status_id,
                  material_id,
                  materialsExist,
                  {
                    orderIndex: orderIndex.toString(),
                    stockIndex: stockIndex.toString(),
                  }
                ),
                this.#isOrderedQtyValid(
                  c,
                  ctx,
                  material_id,
                  stockItem.allocated_qty,
                  materialsExist,
                  {
                    orderIndex: orderIndex.toString(),
                    stockIndex: stockIndex.toString(),
                  }
                ),
                this.#isStockAvailable(
                  c,
                  ctx,
                  {
                    orderIndex: orderIndex.toString(),
                    stockIndex: stockIndex.toString(),
                  },
                  {
                    stock_id: stockItem.stock_id,
                    activity_id: stockItem.activity_id,
                    material_id,
                  },
                  stockItem.allocated_qty,
                  stocksExist
                ),
              ])
            })
          )
        }
      }
    )
  }

  readonly #isCustomerVendorNotTheSame = (
    c: Context,
    ctx: z.RefinementCtx,
    data: CreateOrderAllocationRequest
  ) => {
    if (data.customer_id === data.vendor_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: c.var.t("validator.not_same_value", {
          field1: "Customer",
          field2: "Vendor",
        }),
        path: ["customer_vendor"],
      })
    }
  }

  readonly #isCustomerBelongsToVendor = async (
    c: Context,
    ctx: z.RefinementCtx,
    data: CreateOrderAllocationRequest
  ) => {
    const vendors =
      await this.entityVendorRepository.getListEntityVendorWithoutPagination(
        c,
        data.customer_id,
        { page: 0, paginate: 0, offset: 0, keyword: undefined },
        c.var.programId
      )

    const vendor = vendors.find((vendor) => vendor.id === data.vendor_id)
    if (!vendor) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "validator.not_exist",
        path: ["customer_vendor"],
      })
    }
  }

  readonly #isMaterialAndStockDuplicate = (
    c: Context,
    ctx: z.RefinementCtx,
    data: CreateOrderAllocationRequest
  ) => {
    const materialIdSet = new Set<number>()
    const stockIdSet = new Set<number>()

    for (const [index, orderItem] of data.order_items.entries()) {
      if (materialIdSet.has(orderItem.material_id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "validator.duplicated",
          path: ["order_items", toString(index), "material_id"],
        })
      }

      for (const [stockIndex, stockItem] of orderItem.stocks.entries()) {
        if (stockIdSet.has(stockItem.stock_id)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "validator.duplicated",
            path: [
              "order_items",
              toString(index),
              "stocks",
              toString(stockIndex),
              "stock_id",
            ],
          })
        }

        stockIdSet.add(stockItem.stock_id)
      }

      materialIdSet.add(orderItem.material_id)
    }
  }

  readonly #isRequiredDateSameOrAfter = (
    c: Context,
    ctx: z.RefinementCtx,
    data: CreateOrderAllocationRequest
  ) => {
    const requiredDate = moment(data.required_date).format("YYYY-MM-DD")
    const now = moment(new Date()).format("YYYY-MM-DD")

    if (!moment(requiredDate).isSameOrAfter(now)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "validator.order_required_date",
        path: ["required_date"],
      })
    }
  }

  readonly #isEstimatedDateSameOrAfter = (
    c: Context,
    ctx: z.RefinementCtx,
    data: CreateOrderAllocationRequest
  ) => {
    const estimatedDate = moment(data.estimated_date).format("YYYY-MM-DD")
    const now = moment().format("YYYY-MM-DD")

    if (!moment(estimatedDate).isSameOrAfter(now)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Estimated date cannot be before today",
        path: ["estimated_date"],
      })
    }
  }

  readonly #isOrderedQtyValid = (
    c: Context,
    ctx: z.RefinementCtx,
    materialId: number,
    orderedQty: number,
    data: WSMaterialSchema[],
    indexes: Indexes
  ) => {
    const { orderIndex, stockIndex } = indexes
    const material = data.find((material) => material.id === materialId)

    const mod =
      Number(orderedQty) %
      Number(material?.consumption_unit_per_distribution_unit)

    if (material && mod !== 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: c.var.t("validator.order_item_qty_not_multiple_of_ucpud", {
          material: material?.name,
        }),
        path: [
          "order_items",
          orderIndex,
          "stocks",
          stockIndex,
          "allocated_qty",
        ],
      })
    }

    if (
      material &&
      Number(orderedQty) <
        Number(material?.consumption_unit_per_distribution_unit)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: c.var.t("validator.not_less_than", {
          field1: c.var.t("common.qty"),
          field2: c.var.t(
            "material.label.consumption_unit_per_distribution_unit"
          ),
        }),
        path: [
          "order_items",
          orderIndex,
          "stocks",
          stockIndex,
          "allocated_qty",
        ],
      })
    }
  }

  readonly #isMaterialActiveAndExist = (
    c: Context,
    ctx: z.RefinementCtx,
    materialId: number,
    index: number,
    data: WSMaterialSchema[]
  ) => {
    const material = data.find(
      (material) =>
        material.id === materialId && material.status === STATUS.ACTIVE
    )

    if (!material) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "validator.inactive",
        path: ["order_items", toString(index), "material_id"],
      })
    }
  }

  readonly #isStockAvailable = (
    c: Context,
    ctx: z.RefinementCtx,
    indexes: Indexes,
    stockItem: StockIdentifiers,
    orderedQty: number,
    data: ListCheckStockSchema
  ) => {
    const { orderIndex, stockIndex } = indexes
    const { stock_id, material_id, activity_id } = stockItem

    const record = data.find(
      (item) =>
        item.id === stock_id &&
        item.material_id === material_id &&
        item.activity_id === activity_id
    )

    if (!record) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `validator.not_exist`,
        path: [
          "order_items",
          toString(orderIndex),
          "stocks",
          toString(stockIndex),
          "stock_id",
        ],
      })
    }

    if (record?.qty! < orderedQty) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: c.var.t("validator.max_order_quantity", {
          value: record?.qty,
        }),
        path: [
          "order_items",
          orderIndex,
          "stocks",
          stockIndex,
          "allocated_qty",
        ],
      })
    }

    const totalAllocatedQtyTemp = record?.allocated_qty! + orderedQty
    if (record?.qty! < totalAllocatedQtyTemp) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: c.var.t("validator.check_stock_allocation_qty", {
          value: record?.qty! - record?.allocated_qty!,
        }),
        path: [
          "order_items",
          orderIndex,
          "stocks",
          stockIndex,
          "allocated_qty",
        ],
      })
    }
  }

  readonly #isMaterialExist = async (
    c: Context,
    ctx: z.RefinementCtx,
    index: number,
    material?: { id: number }
  ) => {
    if (!material) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "validator.not_exist",
        path: ["order_items", toString(index), "material_id"],
      })
    }
  }

  readonly #isVendorAndCustomerExist = (
    c: Context,
    ctx: z.RefinementCtx,
    data: ListEntityArraySchema,
    vendorId: number,
    customerId: number
  ) => {
    const isVendorExist = data.find((item) => item.id === vendorId)
    const isCustomerExist = data.find((item) => item.id === customerId)

    if (!isVendorExist) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "validator.not_exist",
        path: ["vendor_id"],
      })
    }

    if (!isCustomerExist) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "validator.not_exist",
        path: ["customer_id"],
      })
    }
  }

  readonly #isActivityExist = (
    ctx: z.RefinementCtx,
    data: WSActivitySchema[],
    activityId: number,
    path: string | (string | number)[]
  ) => {
    const isActivityExist = data.find((item) => item.id === activityId)

    if (!isActivityExist) {
      const issuePath = typeof path === "string" ? [path] : path
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "validator.not_exist",
        path: issuePath,
      })
    }
  }

  readonly #isMatchedOrderStockStatusId = (
    c: Context,
    ctx: z.RefinementCtx,
    orderStatusId: number | null,
    materialId: number,
    data: WSMaterialSchema[],
    indexes: Indexes
  ) => {
    const { orderIndex, stockIndex } = indexes
    const isMaterialExist = data.find((item) => item.id === materialId)

    if (
      (isMaterialExist?.is_temperature_sensitive == 1 &&
        orderStatusId == null) ||
      (isMaterialExist?.is_temperature_sensitive == 0 && orderStatusId != null)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: c.var.t("validator.check_material_is_temperature_sensitive", {
          field: "order_stock_status_id",
          value: isMaterialExist?.is_temperature_sensitive,
        }),
        path: [
          "order_items",
          orderIndex,
          "stocks",
          stockIndex,
          "order_stock_status_id",
        ],
      })
    }
  }
}
