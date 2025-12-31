import { DB } from "@/common/infrastructure/database/types/db.js"
import { OrderRelocationRepository } from "./order-relocation.repository.js"
import { EntityRepository } from "@/modules/entity/entity.repository.js"
import { MaterialRepository } from "../material/material.repository"
import { ActivityRepository } from "../activity/activity.repository.js"
import { OrderReasonRepository } from "../order-reason/order-reason.repository.js"
import {
  CreateOrderRelocationSchema,
  CreateOrderRelocationRequestSchema,
  ListEntityArraySchema,
  EntitySchema,
  ReturnEntityLevel,
  WSMaterialSchema,
  WsOrderReasonSchema,
} from "./order-relocation.schema.js"
import { Context } from "hono"
import { z } from "zod"
import { collect } from "@smile/lib/utils.js"
import { BaseRepository } from "../base.repository.js"
import { STATUS } from "@/common/constants/material.js"
import { IS_RELOCATION } from "@/common/constants/order.js"

export class OrderRelocationMiddleware {
  constructor(
    private readonly repo: OrderRelocationRepository,
    private readonly entityRepo: EntityRepository,
    private readonly materialRepo: MaterialRepository,
    private readonly activityRepo: ActivityRepository,
    private readonly orderReasonRepo: OrderReasonRepository
  ) {}

  createSchemaOrderRelocation = (c: Context) => {
    return CreateOrderRelocationSchema.superRefine(
      async (
        data: CreateOrderRelocationRequestSchema,
        ctx: z.RefinementCtx
      ) => {
        this.#isCustomerVendorNotTheSame(c, ctx, data)
        const programId = c.var.programId

        let materialIds = collect(data.order_items, "material_id")
        materialIds = [...new Set(materialIds)]
        let orderReasonIds = collect(data.order_items, "order_reason_id")
        orderReasonIds = [...new Set(orderReasonIds)]
        let childrenMaterialIds = collect(
          data.order_items.flatMap((i) => i.children ?? []),
          "material_id"
        )
        childrenMaterialIds = [...new Set(childrenMaterialIds)]
        const childrenAndMaterialIds = [
          ...new Set([...materialIds, ...childrenMaterialIds]),
        ]

        const [
          entitiesExist,
          materialsExist,
          orderReasonExist,
          parentAndChildrenMaterials,
        ] = await Promise.all([
          this.entityRepo.find(c, { id: [data.customer_id, data.vendor_id] }),
          this.materialRepo.find(c, { id: materialIds }),
          this.orderReasonRepo.find(c, { id: orderReasonIds }),
          childrenMaterialIds.length > 0
            ? this.repo.getWsMaterialByMaterialIds(
                c,
                childrenAndMaterialIds,
                programId
              )
            : null,
        ])

        await this.#isExistById(
          c,
          ctx,
          this.activityRepo,
          "activity_id",
          data.activity_id
        )

        this.#isVendorRelocation(ctx, entitiesExist, data.vendor_id)

        this.#isVendorAndCustomerExist(
          c,
          ctx,
          entitiesExist,
          data.vendor_id,
          data.customer_id
        )

        this.#checkLocationAndPositionEntity(
          c,
          ctx,
          entitiesExist,
          data.vendor_id,
          data.customer_id
        )

        this.#isMaterialDuplicate(c, ctx, data)

        for (const [orderIndex, orderItem] of data.order_items.entries()) {
          const {
            material_id,
            order_reason_id,
            order_stock_status_id,
            ordered_qty,
          } = orderItem

          const isMaterialExist = materialsExist.find(
            (m) => m.id === material_id
          )
          this.#isMaterialExist(c, ctx, orderIndex, isMaterialExist)

          this.#isMaterialActive(
            c,
            ctx,
            material_id,
            `${orderIndex}`,
            materialsExist
          )

          if (order_reason_id)
            this.#isOrderReasonExist(
              ctx,
              order_reason_id,
              orderReasonExist,
              `${orderIndex}`
            )

          if (isMaterialExist) {
            await this.#isOrderedQtyValid(
              c,
              ctx,
              material_id,
              ordered_qty,
              materialsExist,
              `${orderIndex}`
            )
          }

          if (orderItem.children && orderItem.children.length > 0) {
            const listChildrenMaterialId = orderItem.children.map(
              (item) => item.material_id
            )

            const parentMaterial = parentAndChildrenMaterials.find(
              (item) => item.id === material_id
            )
            const childrenMaterials = parentAndChildrenMaterials.filter(
              (item) => listChildrenMaterialId.includes(item.id)
            )

            this.#isChildrenMaterialExists(
              ctx,
              childrenMaterials,
              orderIndex,
              orderItem
            )
            this.#childrenMaterialCannotDuplicate(c, ctx, orderIndex, orderItem)
            await this.#isParentAndChildrenMaterialHasRelation(
              c,
              ctx,
              orderIndex,
              parentMaterial,
              childrenMaterials
            )
            this.#isCorrectMaterialLevel(
              ctx,
              orderIndex,
              parentMaterial,
              childrenMaterials
            )
            this.#isTotalChildrenQtyMatchWithTotalParentQty(
              ctx,
              orderIndex,
              orderItem
            )
          }
        }
      }
    )
  }

  readonly #isExistById = async (
    c: Context,
    ctx: z.RefinementCtx,
    repo: BaseRepository<keyof DB>,
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

  readonly #isCustomerVendorNotTheSame = (
    c: Context,
    ctx: z.RefinementCtx,
    data: CreateOrderRelocationRequestSchema
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

  readonly #checkLocationAndPositionEntity = (
    c: Context,
    ctx: z.RefinementCtx,
    data: ListEntityArraySchema,
    vendorId: number,
    customerId: number
  ) => {
    const vendor = data.find((item) => item.id === vendorId)
    const customer = data.find((item) => item.id === customerId)

    const vendorLevel = this.#getLocationLevel(vendor)
    const customerLevel = this.#getLocationLevel(customer)

    // If the vendor and customer location levels are not the same
    if (vendorLevel !== customerLevel) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: c.var.t(
          "validator.vendor_and_customer_location_levels_are_not_the_same",
          {
            vendorLevel: vendorLevel,
            customerLevel: customerLevel,
          }
        ),
        path: ["customer_vendor"],
      })
      return
    }

    // Validate location similarity based on level
    switch (vendorLevel) {
      case "province":
        if (
          vendor?.country !== customer?.country &&
          vendor?.province_id !== customer?.province_id
        ) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "validator.relocation.province",
            path: ["customer_vendor"],
          })
        }
        break

      case "regency":
        if (
          vendor?.province_id !== customer?.province_id &&
          vendor?.regency_id !== customer?.regency_id
        ) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "validator.relocation.regency",
            path: ["customer_vendor"],
          })
        }
        break

      case "sub_district":
        if (
          vendor?.province_id !== customer?.province_id &&
          vendor?.regency_id !== customer?.regency_id &&
          vendor?.sub_district_id !== customer?.sub_district_id
        ) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "validator.relocation.sub_district",
            path: ["customer_vendor"],
          })
        }
        break

      default:
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "validator.invalid_or_incomplete_vendor_or_customer_location_level.",
          path: ["customer_vendor"],
        })
        break
    }
  }

  readonly #getLocationLevel = (entity: EntitySchema): ReturnEntityLevel => {
    if (
      entity?.province_id &&
      !entity?.regency_id &&
      !entity?.sub_district_id
    ) {
      return "province"
    }
    if (entity?.province_id && entity?.regency_id && !entity?.sub_district_id) {
      return "regency"
    }
    if (entity?.province_id && entity?.regency_id && entity?.sub_district_id) {
      return "sub_district"
    }
    return "unknown"
  }

  readonly #isMaterialDuplicate = (
    c: Context,
    ctx: z.RefinementCtx,
    data: CreateOrderRelocationRequestSchema
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
        path: ["order_items", `${index}`, "material_id"],
      })
    }
  }

  readonly #isOrderedQtyValid = async (
    c: Context,
    ctx: z.RefinementCtx,
    materialId: number,
    orderedQty: number,
    data: WSMaterialSchema[],
    index: string
  ) => {
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
        path: ["order_items", index, "ordered_qty"],
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
        path: ["order_items", index, "ordered_qty"],
      })
    }
  }

  readonly #isMaterialActive = (
    c: Context,
    ctx: z.RefinementCtx,
    materialId: number,
    index: string,
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
        path: ["order_items", index, "material_id"],
      })
    }
  }

  readonly #isOrderReasonExist = async (
    ctx: z.RefinementCtx,
    orderReasonId?: number,
    data: WsOrderReasonSchema[],
    index: string
  ) => {
    if (orderReasonId && !data.find((reason) => reason.id === orderReasonId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "validator.not_exist",
        path: ["order_items", index, "order_reason_id"],
      })
    }
  }

  readonly #isChildrenMaterialExists = (
    ctx: z.RefinementCtx,
    childrenMaterials: WSMaterialSchema[],
    index: number,
    orderItem
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
    parentMaterials: WSMaterialSchema,
    childrenMaterials: WSMaterialSchema[]
  ) => {
    if (parentMaterials && childrenMaterials.length > 0) {
      const parentMaterialGlobalId = parentMaterials!.global_id!

      let childrenMaterialGlobalIds
      if (childrenMaterials.length > 0) {
        childrenMaterialGlobalIds = childrenMaterials.map(
          (item) => item.global_id
        )
      }

      const materialRelations = await this.repo.getMaterialRelationByMaterialId(
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

  readonly #isCorrectMaterialLevel = (
    ctx: z.RefinementCtx,
    index: number,
    parentMaterial: WSMaterialSchema,
    childrenMaterials: WSMaterialSchema[]
  ) => {
    if (parentMaterial > 0 && childrenMaterials.length > 0) {
      const parentLessThanChild = childrenMaterials.every(
        (item) => parentMaterial!.material_level_id! < item.material_level_id
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
            parentMaterial!.material_level_id!
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

  readonly #isVendorRelocation = (
    ctx: z.RefinementCtx,
    data: ListEntityArraySchema,
    vendorId: number
  ) => {
    const relocation = data.find((item) => item.id === vendorId)
    if (relocation?.is_relocation === IS_RELOCATION.FALSE) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "validator.vendor_is_not_relocation",
        path: ["vendor_id"],
      })
    }
  }
}
