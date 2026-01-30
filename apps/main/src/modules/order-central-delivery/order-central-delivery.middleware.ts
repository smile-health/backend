import { STATUS } from "@/common/constants/material.js"
import { USER_ROLE } from "@/common/constants/user.js"
import { DB } from "@/common/infrastructure/database/types/db.js"
import { BaseRepository as BaseRepositoryLib } from "@smile-health/lib/base/repository.js"
import { group } from "@smile-health/lib/utils.js"
import { Context } from "hono"
import moment from "moment"
import { z } from "zod"
import { ActivityRepository } from "../activity/activity.repository.js"
import { WsMaterialDTO } from "../app-mobile-data/app-mobile-data.schema.js"
import { BaseRepository } from "../base.repository.js"
import { BatchRepository } from "../batch/batch.repository.js"
import { BudgetSourceRepository } from "../budget-source/budget-source.repository.js"
import { EntityActivityRepository } from "../entity-activity/entity-activity.repository.js"
import { EntityMaterialRepository } from "../entity-material/entity-material.repository.js"
import { WsEntityMaterialActivitiesDTO } from "../entity-material/entity-material.schema.js"
import { EntityVendorRepository } from "../entity-vendor/entity-vendor.repository.js"
import { EntityRepository } from "../entity/entity.repository.js"
import { ManufactureRepository } from "../manufacture/manufacture.repository.js"
import { MaterialActivityRepository } from "../material-activity/material-activity.repository.js"
import { MaterialRepository } from "../material/material.repository.js"
import {
  CreateRequest,
  CreateSchema,
  WsBudgetSourcesDTO,
  WsManufactureMaterialDTO,
} from "./order-central-delivery.schema.js"

export class OrderCentralDeliveryMiddleware {
  constructor(
    private readonly activityRepo: ActivityRepository,
    private readonly budgetSourceRepo: BudgetSourceRepository,
    private readonly entityRepo: EntityRepository,
    private readonly entityVendorRepo: EntityVendorRepository,
    private readonly manufactureRepo: ManufactureRepository,
    private readonly materialRepo: MaterialRepository,
    private readonly entityActivityRepo: EntityActivityRepository,
    private readonly materialActivityRepo: MaterialActivityRepository,
    private readonly entityMaterialRepo: EntityMaterialRepository,
    private readonly batchRepo: BatchRepository
  ) {}

  createMiddleware = (c: Context) => {
    return CreateSchema.superRefine(async (data, ctx) => {
      this.#isCustomerVendorNotTheSame(c, ctx, data)
      const activityId = data.activity_id

      const budgetSourceIds = Array.from(
        new Set(
          data.order_items.flatMap((item) =>
            item.stocks.map((stock) => stock.budget_source_id)
          )
        )
      )

      await this.#isExistById(
        c,
        ctx,
        this.entityRepo,
        "vendor_id",
        data.vendor_id
      )
      await this.#isExistById(
        c,
        ctx,
        this.entityRepo,
        "customer_id",
        data.customer_id
      )
      await this.#isEntityActivityCostumer(
        c,
        ctx,
        data.customer_id,
        data.activity_id
      )

      await this.#isCustomerBelongsToVendor(c, ctx, data)

      await this.#isExistById(
        c,
        ctx,
        this.activityRepo,
        "activity_id",
        data.activity_id
      )

      this.#isRequiredDateSameOrAfter(c, ctx, data?.required_date, [
        "required_date",
      ])

      this.#isMaterialDuplicate(c, ctx, data)
      this.#isBatchCodeAndManufactureDuplicate(c, ctx, data)

      await this.#isEntityActivityDate(c, ctx, data)

      const materialIds: number[] = data.order_items.map(
        (val) => val.material_id
      )

      const [
        materials,
        entityMaterial,
        materialActivities,
        manufactureMaterial,
        budgetSources,
      ] = await Promise.all([
        this.materialRepo.find(c, { id: materialIds, status: STATUS.ACTIVE }),
        this.#isExistEntityMaterial(c, data.vendor_id, materialIds),
        this.materialActivityRepo.find(c, {
          material_id: materialIds,
          activity_id: data.activity_id,
        }),
        this.manufactureRepo.getMaterialManufactureGroup(c, materialIds),
        this.budgetSourceRepo.find(c, { id: budgetSourceIds }),
      ])

      const manufacturesTemperatureSensitive =
        await this.manufactureRepo.getManufactureByIsTemperatureSensitive(c)

      for (const [i, item] of data.order_items.entries()) {
        const material = await this.#isMaterialActiveOrIsManagedBatch(
          c,
          ctx,
          materials,
          item.material_id,
          item.is_managed_in_batch,
          i,
          item.stocks.length
        )

        const isEntityMaterial = entityMaterial[item.material_id] ?? []
        this.#isEntityMaterial(ctx, isEntityMaterial, i)

        const materialActivity = materialActivities.find(
          (val) =>
            val.material_id == item.material_id &&
            val.activity_id == data.activity_id
        )
        if (!materialActivity) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "validator.not_exist",
            path: ["order_items", i, "material_activity"],
          })
        }

        if (item.stocks.length < 1) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "validator.not_empty",
            path: ["order_items", i, "stocks"],
          })
        }

        if (item.is_managed_in_batch) {
          await this.#isBatches(
            c,
            ctx,
            material,
            manufactureMaterial,
            budgetSources,
            i,
            item?.stocks
          )
        } else {
          await this.#isStocks(
            c,
            ctx,
            material,
            i,
            item?.stocks,
            manufacturesTemperatureSensitive
              ? manufacturesTemperatureSensitive.names
              : null
          )
        }
      }

      data.materials = materials
    }).transform((val) => ({ ...val }))
  }

  /**
   * this function with in order middleware, probably in the future should be resuable put in lib
   **/
  readonly #isCustomerVendorNotTheSame = (
    c: Context,
    ctx: z.RefinementCtx,
    data: CreateRequest
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

  /**
   * this function, probably in the future should be resuable put in lib
   **/
  async #getCustomerVendors(c: Context, customer_id: number) {
    const vendors = await this.entityVendorRepo.getVendorsEntityTag(
      c,
      customer_id
    )

    return vendors.result.vendors
  }

  /**
   * this function with in order middleware, probably in the future should be resuable put in lib
   **/
  readonly #isExistById = async (
    c: Context,
    ctx: z.RefinementCtx,
    repo: BaseRepository<keyof DB> | BaseRepositoryLib<DB, keyof DB>,
    path: string | (string | number)[],
    id: number
  ) => {
    const record = await repo.findOne(c, { id })

    if (!record) {
      const issuePath = typeof path === "string" ? [path] : path
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "validator.not_exist",
        path: issuePath,
      })
    }
  }

  /**
   * this function with in order middleware, probably in the future should be resuable put in lib
   **/
  readonly #isCustomerBelongsToVendor = async (
    c: Context,
    ctx: z.RefinementCtx,
    data: CreateRequest
  ) => {
    const vendors = await this.#getCustomerVendors(c, data.customer_id)

    const vendor = vendors.find((vendor) => vendor.id === data.vendor_id)
    if (!vendor) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "validator.not_exist",
        path: ["customer_vendor"],
      })
    }
  }

  /**
   * this function with in order middleware, probably in the future should be resuable put in lib
   **/
  readonly #isRequiredDateSameOrAfter = (
    c: Context,
    ctx: z.RefinementCtx,
    value: Date | undefined | null,
    path: (string | number)[]
  ) => {
    const dateCompare = moment(value).format("YYYY-MM-DD")
    const now = moment(new Date()).format("YYYY-MM-DD")

    if (!moment(dateCompare).isSameOrAfter(now)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "validator.order_required_date",
        path,
      })
    }
  }

  /**
   * this function, probably in the future should be resuable put in lib
   **/
  readonly #isRequiredDateSameOrBefore = (
    c: Context,
    ctx: z.RefinementCtx,
    value: Date,
    path: (string | number)[]
  ) => {
    const dateCompare = moment(value).format("YYYY-MM-DD")
    const now = moment(new Date()).format("YYYY-MM-DD")

    if (!moment(dateCompare).isSameOrBefore(now)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Required date cannot be more than today",
        path,
      })
    } // message need to put in translation
  }

  /**
   * this function, probably in the future should be resuable put in lib
   **/
  readonly #isMaterialDuplicate = (
    c: Context,
    ctx: z.RefinementCtx,
    data: CreateRequest
  ) => {
    const materialIdSet = new Set<number>()

    for (const [index, orderItem] of data.order_items.entries()) {
      if (materialIdSet.has(orderItem.material_id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "validator.duplicated",
          path: ["order_items", index, "material_id"],
        })
      }

      materialIdSet.add(orderItem.material_id)
    }
  }

  readonly #isBatchCodeAndManufactureDuplicate = (
    c: Context,
    ctx: z.RefinementCtx,
    data: CreateRequest
  ) => {
    for (const [orderItemIndex, orderItem] of data.order_items.entries()) {
      if (!orderItem.is_managed_in_batch || !orderItem.stocks) continue

      const seen = new Set<string>()

      for (const [stockIndex, stock] of orderItem.stocks.entries()) {
        const manufacture = stock.manufacture_name?.trim().toLowerCase() ?? ""
        const batchCode = stock.batch_code?.trim().toLowerCase() ?? ""
        const key = `${manufacture}||${batchCode}`

        if (seen.has(key)) {
          const path: (string | number)[] = [
            "order_items",
            orderItemIndex,
            "stocks",
            stockIndex,
          ]

          if (stock.batch_code && stock.manufacture_name) {
            path.push("batch_code")
          } else if (stock.batch_code) {
            path.push("batch_code")
          } else if (stock.manufacture_name) {
            path.push("manufacture_name")
          }

          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "validator.duplicated",
            path,
          })
        }

        seen.add(key)
      }
    }
  }

  /**
   * this function, probably in the future should be resuable put in lib
   **/
  readonly #isMaterialActiveOrIsManagedBatch = async (
    c: Context,
    ctx: z.RefinementCtx,
    materials: WsMaterialDTO[],
    materialId: number,
    isManagedBatch: boolean,
    index: number,
    length: number
  ) => {
    const findMaterial = materials.find((val) => val.id == materialId)

    if (!findMaterial) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "validator.inactive",
        path: ["order_items", index, "material_id"],
      })
    }

    if (!!findMaterial?.is_managed_in_batch != isManagedBatch) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "validator.unmatch",
        path: ["order_items", index, "is_managed_in_batch"],
      })
    }

    if (!!findMaterial?.is_managed_in_batch == false && length > 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "validator.material_non_batch_cannot_have_more_than_one_stocks",
        path: ["order_items", index, "is_managed_in_batch"],
      })
    }

    return findMaterial
  }

  readonly #isEntityMaterial = async (
    ctx: z.RefinementCtx,
    entityMaterial: WsEntityMaterialActivitiesDTO[],
    index: number
  ) => {
    if (entityMaterial.length == 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "validator.not_exist",
        path: ["order_items", index, "material_id"],
      })
    }
  }

  async #isEntityActivityDate(
    c: Context,
    ctx: z.RefinementCtx,
    data: CreateRequest
  ) {
    const entityActivityList =
      await this.entityActivityRepo.getListEntityActivityDate(
        c,
        { entity_id: data.vendor_id, activities: [] },
        c.var.programId
      )
    const findEntityActivityDate = entityActivityList.find(
      (val) =>
        val.activity_id == data.activity_id && val.entity_id == data.vendor_id
    )

    const startActivityDate = moment(findEntityActivityDate?.start_date).format(
      "YYYY-MM-DD"
    )
    const endActivityDate = moment(findEntityActivityDate?.end_date).format(
      "YYYY-MM-DD"
    )
    const now = moment(new Date()).format("YYYY-MM-DD")

    if (!findEntityActivityDate?.start_date) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: c.var.t("validator.entity_activity_date_missing", {
          field: "transaction",
        }),
        path: ["activity_id"],
      })
    }
    if (
      findEntityActivityDate?.start_date! &&
      moment(now).isBefore(startActivityDate)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: c.var.t("validator.entity_activity_date_not_yet_active", {
          field: "transaction",
        }),
        path: ["activity_id"],
      })
    }
    if (
      findEntityActivityDate?.end_date! &&
      moment(now).isAfter(endActivityDate)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: c.var.t("validator.entity_activity_date_not_active", {
          field: "transaction",
        }),
        path: ["activity_id"],
      })
    }
  }

  async #isOrderQtyWrongPieces(
    c: Context,
    ctx: z.RefinementCtx,
    material: WsMaterialDTO | undefined,
    parentIndex: number,
    stocks: Partial<
      Pick<CreateRequest["order_items"][0], "stocks">["stocks"][0]
    >,
    index: number
  ) {
    const mod =
      Number(stocks.ordered_qty) %
      Number(material?.consumption_unit_per_distribution_unit)

    if (material && mod !== 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: c.var.t("validator.order_item_qty_not_multiple_of_ucpud", {
          material: material?.name,
        }),
        path: ["order_items", parentIndex, "stocks", index, "qty"],
      })
    }

    if (
      material &&
      Number(stocks.ordered_qty) <
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
        path: ["order_items", parentIndex, "stocks", index, "qty"],
      })
    }
  }

  validatePropStockNotEmpty(
    ctx: z.RefinementCtx,
    parentIndex: number,
    j: number,
    stock: Pick<CreateRequest["order_items"][0], "stocks">["stocks"][0]
  ) {
    if (!stock.expired_date!) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "validator.not_empty",
        path: [`order_items`, parentIndex, "stocks", j, "expired_date"],
      })
    }
    if (!stock.manufacture_name!) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "validator.not_empty",
        path: [`order_items`, parentIndex, "stocks", j, "manufacture_name"],
      })
    }
  }

  async #isBatches(
    c: Context,
    ctx: z.RefinementCtx,
    material: WsMaterialDTO | undefined,
    manufactures: Record<number, WsManufactureMaterialDTO[]>,
    budgetSources: WsBudgetSourcesDTO[],
    parentIndex: number,
    stocks: Pick<CreateRequest["order_items"][0], "stocks">["stocks"]
  ) {
    for (const [j, stock] of stocks.entries()) {
      const {
        // activity_id,
        expired_date,
        production_date,
        manufacture_name,
        budget_source_id,
      } = stock

      this.validatePropStockNotEmpty(ctx, parentIndex, j, stock)

      const findManufactureMaterial = manufactures[material?.id ?? 0]
      const findManufactureName = findManufactureMaterial?.find(
        (val) => val.name === manufacture_name
      )

      const findBudgetSourceId = budgetSources.find(
        (val) => val.id === budget_source_id
      )

      if (production_date)
        this.#isRequiredDateSameOrBefore(c, ctx, production_date, [
          `order_items`,
          parentIndex,
          "stocks",
          j,
          "production_date",
        ])
      if (expired_date)
        this.#isRequiredDateSameOrAfter(c, ctx, expired_date, [
          `order_items`,
          parentIndex,
          "stocks",
          j,
          "expired_date",
        ])
      if (!findManufactureName) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "validator.not_exist",
          path: [`order_items`, parentIndex, "stocks", j, "manufacture_name"],
        })
      }
      if (!findBudgetSourceId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "validator.not_exist",
          path: [`order_items`, parentIndex, "stocks", j, "budget_source_id"],
        })
      }
      await this.#isOrderQtyWrongPieces(c, ctx, material, parentIndex, stock, j)
    }
  }

  async #isStocks(
    c: Context,
    ctx: z.RefinementCtx,
    material: WsMaterialDTO | undefined,
    parentIndex: number,
    stocks: Pick<CreateRequest["order_items"][0], "stocks">["stocks"],
    manufactureNames: string[] | null
  ) {
    for (const [j, stock] of stocks.entries()) {
      await this.#isOrderQtyWrongPieces(c, ctx, material, parentIndex, stock, j)

      // manufacture check
      if (
        stock.manufacture_name &&
        manufactureNames &&
        manufactureNames.length > 0
      ) {
        if (!manufactureNames.includes(stock.manufacture_name.toLowerCase())) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "validator.not_exist",
            path: [`order_items`, parentIndex, "stocks", j, "manufacture_name"],
          })
        }
      }
    }
  }

  readonly #isExistEntityMaterial = async (
    c: Context,
    vendorId: number,
    materialIds: number[]
  ) => {
    let checkVendor = c.var.entityId
    if (c.var.roleId === USER_ROLE.SUPERADMIN) {
      checkVendor = vendorId ?? c.var.entityId
    }
    let entityMaterial = []
    entityMaterial = await this.entityMaterialRepo.findAll(
      c,
      {
        page: 0,
        paginate: 0,
        offset: 0,
        keyword: undefined,
      },
      { entityId: checkVendor ?? 0 },
      materialIds,
      c.var.programId
    )

    const existingMaterialIds = entityMaterial.map((item) => item?.material_id)

    const missingMaterialIds = materialIds.filter(
      (id) => !existingMaterialIds.includes(id)
    )

    if (missingMaterialIds.length > 0) {
      const materials = await this.materialRepo.find(c, {
        id: missingMaterialIds,
      })

      const childToParentMap = new Map<number, number>()
      const parentIds: number[] = []

      for (const material of materials) {
        if (material.parent_id) {
          childToParentMap.set(material.id, material.parent_id)
          parentIds.push(material.parent_id)
        }
      }

      if (parentIds.length > 0) {
        const entityParentMaterial = await this.entityMaterialRepo.findAll(
          c,
          {
            page: 0,
            paginate: 0,
            offset: 0,
            keyword: undefined,
          },
          { entityId: checkVendor ?? 0 },
          parentIds,
          c.var.programId
        )

        const clonedAsChild = entityParentMaterial
          .map((record) => {
            const childId = missingMaterialIds.find((id) => {
              const material = materials.find((m) => m.id === id)
              return material?.parent_id === record.material_id
            })

            if (childId) {
              return {
                ...record,
                material_id: childId,
              }
            }
          })
          .filter(Boolean)

        entityMaterial = entityMaterial.concat(clonedAsChild)
      }
    }

    return group(entityMaterial, "material_id")
  }

  readonly #isEntityActivityCostumer = async (
    c: Context,
    ctx: z.RefinementCtx,
    customerId: number,
    activityId: number
  ) => {
    const record =
      await this.entityActivityRepo.getActivityByEntityIdAndActivityId(
        c,
        customerId,
        activityId
      )

    if (!record) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "validator.not_exist",
        path: ["activity_id_customer"],
      })
    }
  }
}
