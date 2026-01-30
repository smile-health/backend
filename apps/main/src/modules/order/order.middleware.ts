import { STATUS } from "@/common/constants/material.js"
import { ORDER_TYPE } from "@/common/constants/order.js"
import { USER_ROLE } from "@/common/constants/user.js"
import { DB } from "@/common/infrastructure/database/types/db.js"
import {
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "@smile-health/lib/error.js"
import { Context } from "hono"
import { createMiddleware } from "hono/factory"
import moment from "moment"
import { z } from "zod"
import { ActivityRepository } from "../activity/activity.repository.js"
import { BaseRepository } from "../base.repository.js"
import { EntityMaterialRepository } from "../entity-material/entity-material.repository.js"
import { EntityVendorRepository } from "../entity-vendor/entity-vendor.repository.js"
import { EntityRepository } from "../entity/entity.repository.js"
import { MaterialRepository } from "../material/material.repository.js"
import { OrderReasonRepository } from "../order-reason/order-reason.repository.js"
import { OrderStockStatusRepository } from "../order-stock-status/order-stock-status.repository.js"
import { OrderTypeRepository } from "../order-type/order-type.repository.js"
import { OrderRepository } from "./order.repository.js"
import {
  CreateOrderRequest,
  CreateOrderRequestSchema,
  LocationUserOrderDTO,
} from "./order.schema.js"
import { includes } from "lodash"

export class OrderMiddleware {
  constructor(
    private readonly repo: OrderRepository,
    private readonly entityRepo: EntityRepository,
    private readonly activityRepo: ActivityRepository,
    private readonly orderTypeRepo: OrderTypeRepository,
    private readonly materialRepo: MaterialRepository,
    private readonly orderReasonRepo: OrderReasonRepository,
    private readonly orderStockStatusRepo: OrderStockStatusRepository,
    private readonly entityVendorRepo: EntityVendorRepository,
    private readonly entityMaterialRepo: EntityMaterialRepository
  ) {}

  validateDateRange = createMiddleware(async (c, next) => {
    const { from_date, to_date } = c.req.query()
    if (from_date && to_date && moment(from_date).isAfter(moment(to_date))) {
      throw new ValidationError("Invalid Date Range")
    }

    await next()
  })

  createSchema = (c: Context) => {
    return CreateOrderRequestSchema.superRefine(
      async (data: CreateOrderRequest, ctx: z.RefinementCtx) => {
        this.#isCustomerVendorNotTheSame(c, ctx, data)

        await this.#isExistById(
          c,
          ctx,
          this.entityRepo,
          "customer_id",
          data.customer_id
        )

        await this.#isExistById(
          c,
          ctx,
          this.entityRepo,
          "vendor_id",
          data.vendor_id
        )

        await this.#isCustomerBelongsToVendor(c, ctx, data)

        await this.#isExistById(
          c,
          ctx,
          this.activityRepo,
          "activity_id",
          data.activity_id
        )

        this.#isRequiredDateSameOrAfter(c, ctx, data)

        this.#isMaterialDuplicate(c, ctx, data)

        for (const [index, orderItem] of data.order_items.entries()) {
          const {
            material_id,
            order_reason_id,
            order_stock_status_id,
            ordered_qty,
          } = orderItem

          const entityMaterial = await this.#isEntityMaterialExist(
            c,
            ctx,
            material_id,
            data.customer_id,
            index
          )

          if (entityMaterial) {
            // If entity mateiral is not exist, ignore the rest of the validation

            await this.#isExistById(
              c,
              ctx,
              this.materialRepo,
              ["order_items", index, "material_id"],
              material_id
            )

            await this.#isMaterialActive(c, ctx, material_id, index)

            await this.#isOrderedQtyValid(
              c,
              ctx,
              material_id,
              ordered_qty,
              index
            )

            if (order_reason_id) {
              await this.#isExistById(
                c,
                ctx,
                this.orderReasonRepo,
                ["order_items", index, "order_reason_id"],
                order_reason_id
              )
            }

            if (order_stock_status_id) {
              await this.#isExistById(
                c,
                ctx,
                this.orderStockStatusRepo,
                ["order_items", index, "order_stock_status_id"],
                order_stock_status_id
              )
            }
          }

          if (orderItem.children && orderItem.children.length > 0) {
            const programId = c.get("programId")

            const parentMaterials = await this.repo.getWsMaterialByMaterialIds(
              c,
              [Number(orderItem.material_id)],
              Number(programId)
            )

            const listChildrenMaterialId = orderItem.children.map(
              (item) => item.material_id
            )

            const childrenMaterials =
              await this.repo.getWsMaterialByMaterialIds(
                c,
                listChildrenMaterialId,
                Number(programId)
              )

            this.#isParentAndChildrenMaterialExists(
              c,
              ctx,
              index,
              orderItem,
              parentMaterials,
              childrenMaterials
            )
            this.#childrenMaterialCannotDuplicate(c, ctx, index, orderItem)
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
            this.#isTotalChildrenQtyMatchWithTotalParentQty(
              c,
              ctx,
              index,
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

  readonly #isCustomerBelongsToVendor = async (
    c: Context,
    ctx: z.RefinementCtx,
    data: CreateOrderRequest
  ) => {
    const vendors =
      await this.entityVendorRepo.getListEntityVendorWithoutPagination(
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

  readonly #isCustomerVendorNotTheSame = (
    c: Context,
    ctx: z.RefinementCtx,
    data: CreateOrderRequest
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

  readonly #isRequiredDateSameOrAfter = (
    c: Context,
    ctx: z.RefinementCtx,
    data: CreateOrderRequest
  ) => {
    if (data.required_date) {
      const requiredDate = moment(data.required_date).tz(c.var.timeZone).startOf('day')
      const now = moment(new Date()).tz(c.var.timeZone).startOf('day')
      
      if (!moment(requiredDate).isSameOrAfter(now)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "validator.order_required_date",
          path: ["required_date"],
        })
      }
    }
  }

  readonly #isMaterialDuplicate = (
    c: Context,
    ctx: z.RefinementCtx,
    data: CreateOrderRequest
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

  readonly #isMaterialActive = async (
    c: Context,
    ctx: z.RefinementCtx,
    materialId: number,
    index: number
  ) => {
    const material = await this.materialRepo.findOne(c, {
      id: materialId,
      status: STATUS.ACTIVE,
    })

    if (!material) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "validator.inactive",
        path: ["order_items", index, "material_id"],
      })
    }
  }

  readonly #isEntityMaterialExist = async (
    c: Context,
    ctx: z.RefinementCtx,
    materialId: number,
    customerId: number,
    index: number
  ) => {
    const record =
      await this.entityMaterialRepo.getEntityMaterialsByEntityIDandMaterialID(
        c,
        c.get("programId"),
        customerId,
        materialId
      )

    if (!record) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "validator.not_exist",
        path: ["order_items", index, "entity_material"],
      })
    }

    return record
  }

  readonly #isOrderedQtyValid = async (
    c: Context,
    ctx: z.RefinementCtx,
    materialId: number,
    orderedQty: number,
    index: number
  ) => {
    const material = await this.materialRepo.findOne(c, { id: materialId })
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

  readonly #IdNotExistsOrHasDeleted = async (c: Context) => {
    const id = c.req.param("id") ?? undefined
    if (id) {
      const exists = await this.repo.getOrderById(
        c,
        Number(id),
        c.get("programId")
      )
      if (!exists)
        throw new NotFoundError(
          c.var.t("validator.not_exist", {
            field: c.var.t("order.label.order_id"),
          })
        )
      if (exists?.deleted_at)
        throw new ValidationError(
          c.var.t("validator.delete", {
            field: c.var.t("order.label.order_id"),
          })
        )
    }
  }

  readonly #isParentAndChildrenMaterialExists = (
    c: Context,
    ctx: z.RefinementCtx,
    index: number,
    orderItem,
    parentMaterials,
    childrenMaterials
  ) => {
    if (parentMaterials.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "validator.not_exist",
        path: ["order_items", index, "material_id"],
      })
    }

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

  readonly #getAuthorityId = (location) => {
    let authorityId = null

    if (location?.sub_district_id) {
      authorityId = location.sub_district_id
    } else if (location?.regency_id) {
      authorityId = location.regency_id
    } else if (location?.province_id) {
      authorityId = location.province_id
    }

    return authorityId
  }

  readonly #IsManagerAuthority = async (c: Context) => {
    const id = c.req.param("id")
    const roleId = c.get("roleId")
    if (id && roleId === USER_ROLE.MANAGER) {
      const order = await this.repo.getOrderById(
        c,
        Number(id),
        c.get("programId")
      )

      let locationCustomerOrVendor
      if (order?.order_type_id === ORDER_TYPE.RETURN) {
        locationCustomerOrVendor =
          await this.repo.getLocationEntityVendorByOrderId(
            c,
            Number(id),
            c.get("programId")
          )
      } else {
        locationCustomerOrVendor =
          await this.repo.getLocationEntityCustomerByOrderId(
            c,
            Number(id),
            c.get("programId")
          )
      }

      const { entityId } = c.var
      let locationUser: LocationUserOrderDTO
      if (entityId) {
        locationUser = await this.repo.getLocationUserByWsEntityId(
          c,
          entityId,
          c.get("programId")
        )
      }

      const userAuthorityId = this.#getAuthorityId(locationUser)
      const customerAuthorityId = this.#getAuthorityId(locationCustomerOrVendor)
      if (userAuthorityId) {
        if (order?.order_type_id === ORDER_TYPE.RELOCATION) {
          const userLocation =
            await this.repo.getLevelAndParentLocationByLocationId(
              c,
              Number(userAuthorityId)
            )
          const customerLocation =
            await this.repo.getLevelAndParentLocationByLocationId(
              c,
              Number(customerAuthorityId)
            )
          if (
            userLocation?.parent_id !== customerLocation?.parent_id &&
            userLocation?.level !== customerLocation?.level
          ) {
            throw new ForbiddenError()
          }
        } else {
          const locationAuthority =
            await this.repo.getLocationsAuthorityByEntityLocationId(
              c,
              Number(userAuthorityId)
            )

          const locationAuthorityList = locationAuthority.map(
            (location) => location.id
          )

          if (
            customerAuthorityId &&
            !locationAuthorityList.includes(Number(customerAuthorityId))
          ) {
            throw new ForbiddenError()
          }
        }
      }
    }
  }

  detail = createMiddleware(async (c, next) => {
    await this.#IdNotExistsOrHasDeleted(c)
    await this.#IsManagerAuthority(c)
    await next()
  })
}
