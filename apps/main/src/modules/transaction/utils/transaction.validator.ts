import { TRANSACTION_TYPE } from "@/common/constants/transaction.js"
import { getDefaultNumber } from "@smile-health/lib/utils.js"
import { conditionsMessage } from "@smile-health/lib/zod.js"
import { Context } from "hono"
import { MaterialRequest } from "../transaction.schema.js"

interface UserData {
  role?: string | number | null
  type?: string | number | null
  [key: string]: string | number | null | undefined
}

interface MaterialPermission {
  key: string
  value: string
}

interface StockData {
  material_id: number | null
  qty?: number
  allocated_qty?: number | null
  id?: number
  batch_id?: number | null
  [key: string]: string | number | boolean | null | undefined
}

interface MaterialAssociate {
  id: number
  name: string
  consumption_unit_per_distribution_unit: number
}

type RefineContext = any // eslint-disable-line @typescript-eslint/no-explicit-any

export class TransactionValidator {
  static getTransactionTypeFromURL(
    c: Context
  ): (typeof TRANSACTION_TYPE)[keyof typeof TRANSACTION_TYPE] {
    if (c.req.url.includes("add-stock")) {
      return TRANSACTION_TYPE.ADD_STOCK
    } else if (c.req.url.includes("remove-stock")) {
      return TRANSACTION_TYPE.REMOVE_STOCK
    } else if (c.req.url.includes("consumption")) {
      return TRANSACTION_TYPE.CONSUMPTION
    }
    return TRANSACTION_TYPE.DISCARDS
  }

  static isMaterialHavePermission(
    userData: UserData,
    materialsPermissonData: Record<number, MaterialPermission[] | undefined>,
    materialId: number
  ): boolean {
    const materialPermissons = materialsPermissonData[materialId]
    const isRoleAllow = materialPermissons?.some((permission) => {
      return permission.key === "roles" && permission.value === userData.role
    })
    const isEntityAllow = materialPermissons?.some((permission) => {
      return (
        permission.key === "entity_types" && permission.value === userData.type
      )
    })
    return !(isRoleAllow || isEntityAllow)
  }

  static checkMaterialInStock(
    idx: number,
    c: Context,
    ctx: RefineContext,
    stockData: Record<number, StockData | undefined>,
    stockId: number | null,
    materialId: number
  ): void {
    if (!stockId) return
    const stock = stockData[stockId] ?? { material_id: null }
    conditionsMessage(
      ctx,
      c.var.t("transaction.label.stock_material"),
      stock && stock.material_id !== materialId,
      [`materials.${idx}.material_id`]
    )
  }

  static checkMaterialWithoutStockQuality(
    c: Context,
    ctx: RefineContext,
    idx: number,
    userData: UserData,
    material: MaterialRequest,
    materialAssociate: Record<number, MaterialAssociate | undefined>,
    materialsPermissonData: Record<number, MaterialPermission[] | undefined>
  ): void {
    const stateCheckQty = [
      TRANSACTION_TYPE.REMOVE_STOCK,
      TRANSACTION_TYPE.DISCARDS,
    ]
    const stateTransaction = this.getTransactionTypeFromURL(c)

    if (stateCheckQty.includes(stateTransaction)) {
      conditionsMessage(
        ctx,
        c.var.t("auth.forbidden"),
        this.isMaterialHavePermission(
          userData,
          materialsPermissonData,
          material.material_id
        ),
        [`materials.${idx}.material_id`]
      )
    }

    conditionsMessage(
      ctx,
      c.var.t("validator.number", {
        field: c.var.t("transaction.label.material_id"),
      }),
      !getDefaultNumber(material.material_id),
      [`materials.${idx}.material_id`]
    )

    conditionsMessage(
      ctx,
      c.var.t("validator.not_exist", {
        field: c.var.t("transaction.label.material_id"),
      }),
      !materialAssociate[material.material_id],
      [`materials.${idx}.material_id`]
    )

    const materialInfo = materialAssociate[material.material_id]
    const qty = material.qty ?? material.close_vial ?? 0
    if (
      materialInfo &&
      qty % materialInfo.consumption_unit_per_distribution_unit !== 0
    ) {
      conditionsMessage(
        ctx,
        c.var.t("validator.order_item_qty_not_multiple_of_ucpud", {
          material: materialInfo.name,
        }),
        true,
        [`materials.${idx}.qty`]
      )
    }
  }

  static checkStockQty(
    c: Context,
    ctx: RefineContext,
    idx: number,
    material: MaterialRequest,
    stockAssociate: Record<number, StockData | undefined>
  ): void {
    conditionsMessage(
      ctx,
      c.var.t("validator.greater_than", {
        field1: c.var.t("transaction.label.qty"),
        field2: 0,
      }),
      material.qty < 1,
      [`materials.${idx}.qty`]
    )

    if (!material.stock_id) return

    const stock = stockAssociate[material.stock_id]
    if (!stock) return

    const stateCheckQty = [
      TRANSACTION_TYPE.REMOVE_STOCK,
      TRANSACTION_TYPE.DISCARDS,
      TRANSACTION_TYPE.CONSUMPTION,
    ]
    const stateTransaction = this.getTransactionTypeFromURL(c)

    if (!stateCheckQty.includes(stateTransaction)) return

    if ((stock.qty ?? 0) - (stock.allocated_qty ?? 0) < material.qty) {
      conditionsMessage(
        ctx,
        c.var.t("validator.not_greater_than", {
          field1: c.var.t("transaction.label.qty"),
          field2: `${c.var.t("transaction.label.qty")} ${c.var.t("transaction.label.stock")}`,
        }),
        true,
        [`materials.${idx}.qty`]
      )
    }
  }
}
