import { TRANSACTION_TYPE } from "@/common/constants/transaction.js"
import { ValidationError } from "@smile/lib/error.js"
import {
  associate,
  convertToBoolean,
  getDefaultNumber,
} from "@smile/lib/utils.js"
import { conditionsMessage } from "@smile/lib/zod.js"
import { Context } from "hono"
import { createMiddleware } from "hono/factory"
import { ActivityRepository } from "../activity/activity.repository.js"
import { EntityActivityRepository } from "../entity-activity/entity-activity.repository.js"
import { MaterialRepository } from "../material/material.repository.js"
import { StockQualityRepository } from "../stock-quality/stock-quality.repository.js"
import { StockRepository } from "../stock/stock.repository.js"
import { TransactionRepository } from "./transaction.repository.js"
import {
  CancelationDiscardSchema,
  ConsumptionSchema,
  MaterialRequest,
  SubmitReturnOfHealthFacilitiesRequest,
  TransactionListDiscardRequestSchema,
  TransactionSchema,
  TrxReturnedQty,
  ListTrxPatientRabies,
  TrxSubmitReturnOfHealth,
} from "./transaction.schema.js"
import moment from "moment"
import { BatchRepository } from "../batch/batch.repository.js"
import { EntityRepository } from "../entity/entity.repository.js"

export class TransactionsMiddleware {
  constructor(
    private readonly repository: TransactionRepository,
    private readonly activityRepo: ActivityRepository,
    private readonly stockQualityRepo: StockQualityRepository,
    private readonly materialRepo: MaterialRepository,
    private readonly stockRepo: StockRepository,
    private readonly entityActivityRepo: EntityActivityRepository,
    private readonly batchRepo: BatchRepository,
    private readonly entityRepo: EntityRepository
  ) {}

  readonly #getTransactionTypeFromURL = (c: Context) => {
    if (c.req.url.includes("add-stock")) {
      return TRANSACTION_TYPE.ADD_STOCK
    } else if (c.req.url.includes("remove-stock")) {
      return TRANSACTION_TYPE.REMOVE_STOCK
    } else {
      return TRANSACTION_TYPE.DISCARDS
    }
  }

  readonly #optionalValueNumber = (value: string | number | null) => {
    if (value === null) return false
    const numberValue = getDefaultNumber(value)
    if (numberValue === 0) return true
    return false
  }

  readonly #isMaterialHavePermission = (
    userData,
    materialsPermissonData,
    materialId,
    c: Context
  ) => {
    const stateTransaction = this.#getTransactionTypeFromURL(c)
    const transactionWithoutPermisson = [
      TRANSACTION_TYPE.ADD_STOCK,
      TRANSACTION_TYPE.REMOVE_STOCK,
    ]
    if (!transactionWithoutPermisson.includes(stateTransaction)) {
      return false
    }
    let isForbidden: boolean = false
    const materialPermissons = materialsPermissonData[materialId]
    const isRoleAllow = materialPermissons?.some((permission) => {
      return permission.key === "roles" && permission.value === userData.role
    })
    const isEntityAllow = materialPermissons?.some((permission) => {
      return (
        permission.key === "entity_types" && permission.value === userData.type
      )
    })
    if (!isRoleAllow && !isEntityAllow) {
      isForbidden = true
    }
    return isForbidden
  }

  readonly #checkMaterialInStock = (
    idx: number,
    c: Context,
    ctx,
    stockData,
    stockId: number | null,
    materialId: number
  ) => {
    if (!stockId) return
    const stock = stockData[stockId] ?? { material_id: null }
    conditionsMessage(
      ctx,
      c.var.t("transaction.label.stock_material"),
      stock && stock.material_id !== materialId,
      [`materials.${idx}.material_id`]
    )
  }

  readonly #checkIsPurchase = (
    idx: number,
    c: Context,
    ctx,
    material: MaterialRequest,
    is_purchase: boolean,
    budgetSources
  ) => {
    const stateTransaction = this.#getTransactionTypeFromURL(c)
    if (
      stateTransaction === TRANSACTION_TYPE.REMOVE_STOCK ||
      stateTransaction === TRANSACTION_TYPE.DISCARDS
    )
      return
    if (!is_purchase) return

    conditionsMessage(
      ctx,
      c.var.t("validator.not_empty", {
        field: c.var.t("transaction.label.budget_source_id"),
      }),
      !material.budget_source_id,
      [`materials.${idx}.budget_source_id`]
    )

    conditionsMessage(
      ctx,
      c.var.t("validator.not_exist", {
        field: c.var.t("transaction.label.budget_source_id"),
      }),
      !!material.budget_source_id &&
        !budgetSources[getDefaultNumber(material.budget_source_id)],
      [`materials.${idx}.budget_source_id`]
    )

    conditionsMessage(
      ctx,
      c.var.t("validator.not_empty", {
        field: c.var.t("transaction.label.price"),
      }),
      !material.price,
      [`materials.${idx}.price`]
    )

    conditionsMessage(
      ctx,
      c.var.t("validator.greater_than", {
        field1: c.var.t("transaction.label.price"),
        field2: 0,
      }),
      !!material.price && material.price <= 0,
      [`materials.${idx}.price`]
    )

    conditionsMessage(
      ctx,
      c.var.t("validator.not_empty", {
        field: c.var.t("transaction.label.year"),
      }),
      !material.year,
      [`materials.${idx}.year`]
    )

    conditionsMessage(
      ctx,
      c.var.t("validator.greater_than", {
        field1: c.var.t("transaction.label.year"),
        field2: 0,
      }),
      !!material.year && material.year < 1,
      [`materials.${idx}.year`]
    )

    conditionsMessage(
      ctx,
      c.var.t("validator.number", {
        field: c.var.t("transaction.label.budget_source_id"),
      }),
      !getDefaultNumber(material.budget_source_id),
      [`materials.${idx}.budget_source_id`]
    )

    conditionsMessage(
      ctx,
      c.var.t("validator.number", {
        field: c.var.t("transaction.label.price"),
      }),
      !getDefaultNumber(material.price),
      [`materials.${idx}.price`]
    )

    conditionsMessage(
      ctx,
      c.var.t("validator.number", {
        field: c.var.t("transaction.label.year"),
      }),
      !getDefaultNumber(material.year),
      [`materials.${idx}.year`]
    )
  }

  readonly #checkBatchIsExist = async (
    c: Context,
    ctx,
    idx: number,
    material: MaterialRequest,
    manufactureAssociate
  ) => {
    if (!material.batch) return
    const currentIsoDate = new Date().toISOString().split("T")[0]

    conditionsMessage(
      ctx,
      c.var.t("validator.not_greater_than", {
        field1: c.var.t("transaction.label.code"),
        field2: 255,
      }),
      material.batch.code.length > 255,
      [`materials.${idx}.batch.code`]
    )

    conditionsMessage(
      ctx,
      c.var.t("validator.number", {
        field: c.var.t("transaction.label.manufacture_id"),
      }),
      !getDefaultNumber(material.batch?.manufacture_id),
      [`materials.${idx}.batch.manufacture_id`]
    )

    conditionsMessage(
      ctx,
      c.var.t("validator.not_exist", {
        field: c.var.t("transaction.label.manufacture_id"),
      }),
      !manufactureAssociate[getDefaultNumber(material.batch?.manufacture_id)],
      [`materials.${idx}.batch.manufacture_id`]
    )

    conditionsMessage(
      ctx,
      c.var.t("validator.date", {
        field: c.var.t("transaction.label.production_date"),
      }),
      !!material.batch.production_date &&
        isNaN(new Date(material.batch.production_date).getTime()),
      [`materials.${idx}.batch.production_date`]
    )

    conditionsMessage(
      ctx,
      c.var.t("validator.date", {
        field: c.var.t("transaction.label.expired_date"),
      }),
      isNaN(new Date(material.batch.expired_date).getTime()),
      [`materials.${idx}.batch.expired_date`]
    )

    conditionsMessage(
      ctx,
      c.var.t("validator.not_greater_than", {
        field1: c.var.t("transaction.label.production_date"),
        field2: c.var.t("transaction.label.expired_date"),
      }),
      !!material.batch.production_date &&
        material.batch.production_date > material.batch.expired_date,
      [`materials.${idx}.batch.production_date`]
    )

    conditionsMessage(
      ctx,
      c.var.t("validator.not_greater_than", {
        field1: c.var.t("transaction.label.production_date"),
        field2: currentIsoDate,
      }),
      !!material.batch.production_date &&
        new Date(material.batch.production_date) > new Date(),
      [`materials.${idx}.batch.production_date`]
    )

    conditionsMessage(
      ctx,
      c.var.t("validator.not_less_than", {
        field1: c.var.t("transaction.label.expired_date"),
        field2: currentIsoDate,
      }),
      new Date(material.batch.expired_date) < new Date(currentIsoDate!),
      [`materials.${idx}.batch.expired_date`]
    )

    //check duplicate batch code
    const isExist = await this.batchRepo.findOne(c, {
      code: material.batch.code,
      material_id: material.material_id,
      manufacture_id: material.batch.manufacture_id,
    })

    if (isExist) {
      material.batch_id = isExist.id
    }

    // conditionsMessage(
    //   ctx,
    //   c.var.t("validator.exist", {
    //     field: c.var.t("transaction.label.code"),
    //   }),
    //   !!isExist,
    //   [`materials.${idx}.batch.code`]
    // )
  }

  readonly #checkStockAndBatch = async (
    c: Context,
    ctx,
    idx: number,
    material: MaterialRequest,
    stockAssociate,
    manufactureAssociate
  ) => {
    const stateTransaction = this.#getTransactionTypeFromURL(c)
    const transactionTypeMandatoryStock = [
      TRANSACTION_TYPE.REMOVE_STOCK,
      TRANSACTION_TYPE.DISCARDS,
    ]

    // validate stock id mandatory
    if (transactionTypeMandatoryStock.includes(stateTransaction)) {
      conditionsMessage(
        ctx,
        c.var.t("validator.not_empty", {
          field: c.var.t("transaction.label.stock_id"),
        }),
        material.stock_id === null,
        [`materials.${idx}.stock_id`]
      )

      conditionsMessage(
        ctx,
        c.var.t("validator.number", {
          field: c.var.t("transaction.label.stock_id"),
        }),
        material?.stock_id !== null && !getDefaultNumber(material.stock_id),
        [`materials.${idx}.stock_id`]
      )
    }

    conditionsMessage(
      ctx,
      c.var.t("validator.not_exist", {
        field: c.var.t("transaction.label.stock_id"),
      }),
      material?.stock_id !== null && !stockAssociate[material.stock_id],
      [`materials.${idx}.stock_id`]
    )

    if (transactionTypeMandatoryStock.includes(stateTransaction)) return
    // validation add stock
    conditionsMessage(
      ctx,
      c.var.t("validator.number", {
        field: c.var.t("transaction.label.stock_id"),
      }),
      this.#optionalValueNumber(material.stock_id),
      [`materials.${idx}.stock_id`]
    )

    await this.#checkBatchIsExist(c, ctx, idx, material, manufactureAssociate)

    if (
      !material.stock_id &&
      !material.batch?.code &&
      material.is_managed_in_batch
    ) {
      conditionsMessage(
        ctx,
        c.var.t("validator.selected_atleast_one", {
          field1: c.var.t("transaction.label.stock_id"),
          field2: c.var.t("transaction.label.batch"),
        }),
        true,
        [`materials.${idx}.stock_id`]
      )
    }

    if (
      !material.stock_id &&
      !material.batch &&
      !material.is_managed_in_batch
    ) {
      const stock = await this.stockRepo.findOne(c, {
        activity_id: material.activity_id,
        entity_id: material.entity_id,
        material_id: material.material_id,
      })
      console.log(stock)
      conditionsMessage(
        ctx,
        c.var.t("validator.not_empty", {
          field: c.var.t("transaction.label.stock_id"),
        }),
        !!stock,
        [`materials.${idx}.stock_id`]
      )
    }

    if (material.stock_id && material.batch) {
      conditionsMessage(
        ctx,
        c.var.t("validator.field_conflict_error", {
          field1: c.var.t("transaction.label.stock_id"),
          field2: c.var.t("transaction.label.batch"),
        }),
        true,
        [`materials.${idx}.stock_id`]
      )
    }
  }

  readonly #checkTransactionReason = (
    c: Context,
    ctx,
    idx: number,
    material: MaterialRequest,
    transactionReasonAssociate
  ) => {
    conditionsMessage(
      ctx,
      c.var.t("validator.number", {
        field: c.var.t("transaction.label.transaction_reason_id"),
      }),
      !getDefaultNumber(material.transaction_reason_id),
      [`materials.${idx}.transaction_reason_id`]
    )

    conditionsMessage(
      ctx,
      c.var.t("validator.not_exist", {
        field: c.var.t("transaction.label.transaction_reason_id"),
      }),
      !transactionReasonAssociate[material.transaction_reason_id],
      [`materials.${idx}.transaction_reason_id`]
    )

    conditionsMessage(
      ctx,
      c.var.t("validator.not_empty", {
        field: c.var.t("transaction.label.other_reason"),
      }),
      !!material.is_other && !material.other_reason,
      [`materials.${idx}.other_reason`]
    )

    conditionsMessage(
      ctx,
      c.var.t("validator.not_greater_than", {
        field1: c.var.t("transaction.label.other_reason"),
        field2: 255,
      }),
      !!material.is_other &&
        !!material.other_reason &&
        material.other_reason.length > 255,
      [`materials.${idx}.other_reason`]
    )
  }

  readonly #checkMaterial = (
    c: Context,
    ctx,
    idx: number,
    userData,
    material: MaterialRequest,
    materialAssociate,
    StockQualityAssociate,
    materialsPermissonData,
    isOpenVial: boolean = false
  ) => {
    const labelQty = isOpenVial ? "close_vial" : "qty"
    const materialData = materialAssociate[material.material_id]
    const stockQualityData =
      StockQualityAssociate[getDefaultNumber(material.stock_quality_id)]

    conditionsMessage(
      ctx,
      c.var.t("auth.forbidden"),
      this.#isMaterialHavePermission(
        userData,
        materialsPermissonData,
        material.material_id,
        c
      ),
      [`materials.${idx}.material_id`]
    )

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

    // material sensitive
    conditionsMessage(
      ctx,
      c.var.t("validator.not_empty", {
        field: c.var.t("transaction.label.stock_quality_id"),
      }),
      materialData?.is_temperature_sensitive && !material.stock_quality_id,
      [`materials.${idx}.stock_quality_id`]
    )

    conditionsMessage(
      ctx,
      c.var.t("validator.number", {
        field: c.var.t("transaction.label.stock_quality_id"),
      }),
      materialData?.is_temperature_sensitive &&
        !getDefaultNumber(material.stock_quality_id),
      [`materials.${idx}.stock_quality_id`]
    )

    conditionsMessage(
      ctx,
      c.var.t("validator.not_exist", {
        field: c.var.t("transaction.label.stock_quality_id"),
      }),
      materialData?.is_temperature_sensitive && !stockQualityData,
      [`materials.${idx}.stock_quality_id`]
    )

    if (!materialData?.is_temperature_sensitive && material.stock_quality_id) {
      conditionsMessage(
        ctx,
        c.var.t("validator.request_not_allowed", {
          field: c.var.t("transaction.label.stock_quality_id"),
        }),
        true,
        [`materials.${idx}.stock_quality_id`]
      )
    }

    // material consumption_unit_per_distribution_unit
    if (
      materialAssociate[material.material_id] &&
      material.qty %
        materialAssociate[material.material_id]
          .consumption_unit_per_distribution_unit !==
        0
    ) {
      conditionsMessage(
        ctx,
        c.var.t("validator.order_item_qty_not_multiple_of_ucpud", {
          material: materialAssociate[material.material_id].name,
        }),
        true,
        [`materials.${idx}.${labelQty}`]
      )
    }
  }

  readonly #checkMaterialWithoutStockQuality = (
    c: Context,
    ctx,
    idx: number,
    userData,
    material: MaterialRequest,
    materialAssociate,
    materialsPermissonData
  ) => {
    conditionsMessage(
      ctx,
      c.var.t("auth.forbidden"),
      this.#isMaterialHavePermission(
        userData,
        materialsPermissonData,
        material.material_id
      ),
      [`materials.${idx}.material_id`]
    )

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

    if (
      materialAssociate[material.material_id] &&
      material.qty %
        materialAssociate[material.material_id]
          .consumption_unit_per_distribution_unit !==
        0
    ) {
      conditionsMessage(
        ctx,
        c.var.t("validator.order_item_qty_not_multiple_of_ucpud", {
          material: materialAssociate[material.material_id].name,
        }),
        true,
        [`materials.${idx}.qty`]
      )
    }
  }

  readonly #checkQtyStock = (
    c: Context,
    ctx,
    idx: number,
    material: MaterialRequest,
    stockAssociate,
    isOpenVial: boolean = false
  ) => {
    const labelQty = isOpenVial ? "close_vial" : "qty"

    let qtyIsRequired = false
    const openVialQtyIsFilled =
      !!material.open_vial || Number(material.open_vial) > 0
    if (
      isOpenVial &&
      Number(material.transaction_type_id) === TRANSACTION_TYPE.DISCARDS &&
      !openVialQtyIsFilled
    )
      qtyIsRequired = true

    conditionsMessage(
      ctx,
      c.var.t("validator.greater_than", {
        field1: c.var.t(`transaction.label.${labelQty}`),
        field2: 0,
      }),
      material.qty! < 1 && qtyIsRequired,
      [`materials.${idx}.${labelQty}`]
    )
    // return if stock id is null
    if (!material.stock_id) return
    // check if stock not exist
    if (!stockAssociate[material.stock_id]) return
    // tambah kan transaction type yang minus qty, sementara baru ini
    const stateCheckQty: number[] = [
      TRANSACTION_TYPE.REMOVE_STOCK,
      TRANSACTION_TYPE.DISCARDS,
    ]
    const stateTransaction = this.#getTransactionTypeFromURL(c)
    // check if state transaction not in state check qty
    if (!stateCheckQty.includes(stateTransaction)) return
    // check if qty is greater than stock qty
    if (
      stockAssociate[material.stock_id]?.qty -
        stockAssociate[material.stock_id]?.allocated_qty <
      material.qty!
    ) {
      conditionsMessage(
        ctx,
        c.var.t("validator.not_greater_than", {
          field1: c.var.t(`transaction.label.${labelQty}`),
          field2:
            c.var.t(`transaction.label.${labelQty}`) +
            " " +
            c.var.t("transaction.label.stock"),
        }),
        true,
        [`materials.${idx}.${labelQty}`]
      )
    }
  }

  readonly #isOpenVial = (
    isEntityTagOpenVial: boolean,
    isMaterialOpenVial: boolean
  ) => {
    return isEntityTagOpenVial && isMaterialOpenVial
  }

  readonly #setQtyIfOpenVial = (
    c: Context,
    materialQty: number,
    closeVialQty: number,
    isOpenVial: boolean
  ) => {
    if (this.#getTransactionTypeFromURL(c) !== TRANSACTION_TYPE.DISCARDS)
      return materialQty
    return isOpenVial ? closeVialQty : materialQty
  }

  readonly #checkIsOpenVial = (
    c: Context,
    ctx,
    idx: number,
    material: MaterialRequest,
    stock,
    isOpenVial: boolean
  ) => {
    // return if not open vial
    if (!isOpenVial) return
    // return if stock id is null
    if (!material.stock_id) return
    // check if stock not exist
    if (!stock) return
    // check close qty can not be empty
    const openVialQtyIsFilled =
      !!material.open_vial || Number(material.open_vial) > 0

    conditionsMessage(
      ctx,
      c.var.t("validator.not_empty", {
        field: c.var.t("transaction.label.close_vial"),
      }),
      !material.close_vial && !openVialQtyIsFilled,
      [`materials.${idx}.close_vial`]
    )

    // check close qty can not be 0
    conditionsMessage(
      ctx,
      c.var.t("validator.greater_than", {
        field1: c.var.t("transaction.label.close_vial"),
        field2: 0,
      }),
      material.close_vial! === 0 && !openVialQtyIsFilled,
      [`materials.${idx}.close_vial`]
    )

    if (!stock.open_vial_qty && !material.open_vial) return
    // check stock open vial qty and material open vial qty must be same
    conditionsMessage(
      ctx,
      c.var.t("validator.same_value", {
        field1: c.var.t("transaction.label.open_vial"),
        field2: c.var.t("transaction.label.stock_open_vial"),
      }),
      (!!material.open_vial || Number(material.open_vial) > 0) &&
        stock.open_vial_qty !== material.open_vial,
      [`materials.${idx}.open_vial`]
    )
  }

  #checkRequestBatchIsUnique = (
    c: Context,
    ctx,
    idx: number,
    material: MaterialRequest,
    batchCodeUniqueSet: Set<string>
  ) => {
    if (!material.batch?.code) return
    console.log(
      `${material.batch?.code}-${material.material_id}-${getDefaultNumber(material.batch?.manufacture_id)}`,
      batchCodeUniqueSet.has(
        `${material.batch?.code}-${material.material_id}-${getDefaultNumber(material.batch?.manufacture_id)}`
      )
    )
    conditionsMessage(
      ctx,
      c.var.t("validator.unique", {
        field: c.var.t("transaction.label.code"),
      }),
      batchCodeUniqueSet.has(
        `${material.batch?.code}-${material.material_id}-${getDefaultNumber(material.batch?.manufacture_id)}`
      ),
      [`materials.${idx}.batch.code`]
    )
  }

  #checkRestrictedBudgetSource = (
    c: Context,
    ctx,
    idx: number,
    budgetSourceAssociate,
    stockAssociate
  ) => {
    const stateTransaction = this.#getTransactionTypeFromURL(c)

    if (stateTransaction === TRANSACTION_TYPE.ADD_STOCK) {
      conditionsMessage(
        ctx,
        c.var.t(
          "budget_source.label.budget_source_is_restricted_for_transaction"
        ),
        budgetSourceAssociate?.is_restricted ===
          (1)[`materials.${idx}.budget_source_id`]
      )
    }
    if (stateTransaction === TRANSACTION_TYPE.REMOVE_STOCK) {
      conditionsMessage(
        ctx,
        c.var.t(
          "budget_source.label.budget_source_is_restricted_for_transaction"
        ),
        stockAssociate?.is_restricted === 1,
        [`materials.${idx}.budget_source_id`]
      )
    }
  }

  addRemoveDiscardStock = async (c: Context) => {
    const userData = await this.repository.findWsUserById(c, c.var.userId!)
    const { entity_id, activity_id } = await c.req.json()
    return TransactionSchema.extend({
      materials: TransactionSchema.shape.materials.superRefine(
        (materials, ctx) => {
          const programId = c.var.programId
          const sets = {
            materialSet: new Set<number>(),
            transactionReasonSet: new Set<number>(),
            stockSet: new Set<number>(),
            manufactureSet: new Set<number>(),
            budgetSourceSet: new Set<number>(),
            stockQualitySet: new Set<number>(),
            batchCodeUniqueSet: new Set<string>(),
          }
          for (const [idx, material] of materials.entries()) {
            material.entity_id = entity_id
            material.activity_id = activity_id

            conditionsMessage(
              ctx,
              c.var.t("validator.invalid_transaction_type", {
                field: c.var.t("transaction.label.transaction_type_id"),
              }),
              !!material.transaction_type_id &&
                ![
                  TRANSACTION_TYPE.ADD_STOCK,
                  TRANSACTION_TYPE.REMOVE_STOCK,
                  TRANSACTION_TYPE.DISCARDS,
                ].includes(Number(material.transaction_type_id)),
              [`materials.${idx}.transaction_type_id`]
            )

            conditionsMessage(
              ctx,
              c.var.t("validator.unique", {
                field: c.var.t("transaction.label.stock_id"),
              }),
              !!getDefaultNumber(material.stock_id) &&
                sets.stockSet.has(getDefaultNumber(material.stock_id)),
              [`materials.${idx}.stock_id`]
            )

            sets.materialSet.add(getDefaultNumber(material.material_id))
            sets.transactionReasonSet.add(
              getDefaultNumber(material.transaction_reason_id)
            )
            sets.stockSet.add(getDefaultNumber(material.stock_id))
            sets.manufactureSet.add(
              getDefaultNumber(material.batch?.manufacture_id)
            )
            sets.budgetSourceSet.add(
              getDefaultNumber(material.budget_source_id)
            )
            sets.stockQualitySet.add(
              getDefaultNumber(material.stock_quality_id)
            )
            // check if batch code is exist
            this.#checkRequestBatchIsUnique(
              c,
              ctx,
              idx,
              material,
              sets.batchCodeUniqueSet
            )
            sets.batchCodeUniqueSet.add(
              `${material.batch?.code}-${material.material_id}-${getDefaultNumber(material.batch?.manufacture_id)}`
            )
          }
          return Promise.all([
            this.repository.findWsMaterialByIds(
              c,
              Array.from(sets.materialSet),
              programId
            ),
            this.repository.findWsTransactionReasonByIds(
              c,
              Array.from(sets.transactionReasonSet)
            ),
            this.repository.findWsStockByIds(
              c,
              Array.from(sets.stockSet),
              programId,
              false
            ),
            this.repository.findWsManufactureByIds(
              c,
              Array.from(sets.manufactureSet),
              programId
            ),
            this.repository.findWsMaterialPermissonByIds(
              c,
              Array.from(sets.materialSet)
            ),
            this.repository.findWsBudgetSourceIds(
              c,
              Array.from(sets.budgetSourceSet),
              programId
            ),
            this.stockQualityRepo.findWsStockQualityIds(
              c,
              Array.from(sets.stockQualitySet)
            ),
            this.entityRepo.getEntityDetail(c, entity_id, programId),
          ]).then(
            async ([
              materialsData,
              transactionReasonData,
              stockData,
              manufactureData,
              materialsPermissonData,
              budgetSourceData,
              stockQualityData,
              entityData,
            ]) => {
              const materialAssociate = associate(materialsData, "id")
              const transactionReasonAssociate = associate(
                transactionReasonData,
                "id"
              )
              const stockAssociate = associate(stockData, "id")
              const manufactureAssociate = associate(manufactureData, "id")
              const budgetSourceAssociate = associate(budgetSourceData, "id")
              const stockQualityAssociate = associate(stockQualityData, "id")
              for (const [idx, material] of materials.entries()) {
                const transactionReason = transactionReasonAssociate[
                  material.transaction_reason_id
                ] || { is_purchase: 0, is_other: 0 }
                const { is_purchase, is_other } = transactionReason as {
                  is_purchase: number
                  is_other: number
                }
                const materialData =
                  materialAssociate[getDefaultNumber(material.material_id)]
                material.is_other = convertToBoolean(is_other)
                material.is_purchase = convertToBoolean(is_purchase)
                material.is_managed_in_batch = convertToBoolean(
                  materialData?.is_managed_in_batch ?? 1
                )
                material.parent_material_id =
                  materialAssociate[getDefaultNumber(material.material_id)]
                    ?.parent_material_id ?? undefined

                const isTransactionDiscard =
                  Number(material.transaction_type_id) ===
                  TRANSACTION_TYPE.DISCARDS

                material.is_open_vial = this.#isOpenVial(
                  isTransactionDiscard ??
                    convertToBoolean(entityData?.is_open_vial ?? 0),
                  convertToBoolean(materialData?.is_open_vial)
                )

                material.qty = this.#setQtyIfOpenVial(
                  c,
                  getDefaultNumber(material.qty),
                  getDefaultNumber(material.close_vial),
                  material.is_open_vial
                )

                this.#checkMaterialInStock(
                  idx,
                  c,
                  ctx,
                  stockAssociate,
                  material.stock_id,
                  material.material_id
                )

                this.#checkIsPurchase(
                  idx,
                  c,
                  ctx,
                  material,
                  convertToBoolean(is_purchase),
                  budgetSourceAssociate
                )

                await this.#checkStockAndBatch(
                  c,
                  ctx,
                  idx,
                  material,
                  stockAssociate,
                  manufactureAssociate
                )

                this.#checkTransactionReason(
                  c,
                  ctx,
                  idx,
                  material,
                  transactionReasonAssociate
                )

                this.#checkMaterial(
                  c,
                  ctx,
                  idx,
                  userData,
                  material,
                  materialAssociate,
                  stockQualityAssociate,
                  materialsPermissonData,
                  material.is_open_vial
                )

                this.#checkQtyStock(
                  c,
                  ctx,
                  idx,
                  material,
                  stockAssociate,
                  material.is_open_vial
                )

                this.#checkIsOpenVial(
                  c,
                  ctx,
                  idx,
                  material,
                  stockAssociate[getDefaultNumber(material.stock_id)],
                  material.is_open_vial
                )

                this.#checkRestrictedBudgetSource(
                  c,
                  ctx,
                  idx,
                  budgetSourceAssociate[material.budget_source_id],
                  stockAssociate[getDefaultNumber(material.stock_id)]
                )
              }
            }
          )
        }
      ),
    }).superRefine(async (data, ctx) => {
      const currentIsoDate = new Date().toISOString().split("T")[0]
      const programId = c.var.programId
      const { activity_id, entity_activity_id } = data
      const [entityData, activityData, entityActivityIdData] =
        await Promise.all([
          this.repository.findWsEntityById(c, data.entity_id, programId),
          this.activityRepo.findById(c, data.activity_id, programId),
          this.repository.findWsEntityActivityById(c, entity_activity_id),
        ])

      conditionsMessage(
        ctx,
        c.var.t("validator.not_exist", {
          field: c.var.t("transaction.label.entity_id"),
        }),
        !entityData,
        ["entity_id"]
      )

      conditionsMessage(
        ctx,
        c.var.t("validator.not_exist", {
          field: c.var.t("transaction.label.activity_id"),
        }),
        !activityData,
        ["activity_id"]
      )

      conditionsMessage(
        ctx,
        c.var.t("transaction.label.activity_end_date"),
        !!(
          entityActivityIdData?.end_date &&
          new Date(entityActivityIdData?.end_date) < new Date(currentIsoDate!)
        ),
        ["activity_id"]
      )

      conditionsMessage(
        ctx,
        c.var.t("validator.not_exist", {
          field: c.var.t("transaction.label.entity_activity_id"),
        }),
        !entityActivityIdData,
        ["entity_activity_id"]
      )

      conditionsMessage(
        ctx,
        c.var.t("validator.unmatch", {
          field: c.var.t("transaction.label.activity_id"),
        }),
        !!entityActivityIdData &&
          entityActivityIdData.activity_id !== activity_id,
        ["entity_activity_id"]
      )
    })
  }

  readonly #checkListDiscardIdIsNaN = (c, data, ctx) => {
    const {
      entity_id,
      activity_id,
      material_type_id,
      material_id,
      transaction_reason_id,
    } = data

    conditionsMessage(
      ctx,
      c.var.t("validator.number", {
        field: c.var.t("transaction.label.entity_id"),
      }),
      isNaN(entity_id),
      ["entity_id"]
    )

    conditionsMessage(
      ctx,
      c.var.t("validator.number", {
        field: c.var.t("transaction.label.activity_id"),
      }),
      isNaN(activity_id),
      ["activity_id"]
    )

    conditionsMessage(
      ctx,
      c.var.t("validator.number", {
        field: c.var.t("transaction.label.material_id"),
      }),
      isNaN(material_id),
      ["material_id"]
    )

    conditionsMessage(
      ctx,
      c.var.t("validator.number", {
        field: c.var.t("transaction.label.transaction_reason_id"),
      }),
      isNaN(transaction_reason_id),
      ["transaction_reason_id"]
    )

    conditionsMessage(
      ctx,
      c.var.t("validator.number", {
        field: c.var.t("material.label.material_type"),
      }),
      isNaN(material_type_id),
      ["material_type_id"]
    )
  }

  readonly #checkListDiscardIdIsExist = async (c, data, ctx) => {
    const programId = c.var.programId
    const {
      entity_id,
      activity_id,
      material_type_id,
      material_id,
      transaction_reason_id,
    } = data
    const [
      entityData,
      activityData,
      materialData,
      materialTypeData,
      transactionReasonData,
    ] = await Promise.all([
      this.repository.findWsEntityById(
        c,
        getDefaultNumber(entity_id),
        programId
      ),
      this.activityRepo.findById(c, getDefaultNumber(activity_id), programId),
      this.repository.findWsMaterialByIds(
        c,
        [getDefaultNumber(material_id)],
        programId
      ),
      this.materialRepo.findMaterialType(c, getDefaultNumber(material_type_id)),
      this.repository.findWsTransactionReasonByIds(
        c,
        [getDefaultNumber(transaction_reason_id)],
        TRANSACTION_TYPE.DISCARDS
      ),
    ])

    conditionsMessage(
      ctx,
      c.var.t("validator.not_exist", {
        field: c.var.t("transaction.label.entity_id"),
      }),
      !!entity_id && !entityData,
      ["entity_id"]
    )

    conditionsMessage(
      ctx,
      c.var.t("validator.not_exist", {
        field: c.var.t("transaction.label.activity_id"),
      }),
      !!activity_id && !activityData,
      ["activity_id"]
    )

    conditionsMessage(
      ctx,
      c.var.t("validator.not_exist", {
        field: c.var.t("transaction.label.material_id"),
      }),
      !!material_id && !materialData[0],
      ["material_id"]
    )

    conditionsMessage(
      ctx,
      c.var.t("validator.not_exist", {
        field: c.var.t("material.label.material_type"),
      }),
      !!material_type_id && !materialTypeData,
      ["material_type_id"]
    )

    conditionsMessage(
      ctx,
      c.var.t("validator.not_exist", {
        field: c.var.t("transaction.label.transaction_reason_id"),
      }),
      !!transaction_reason_id && !transactionReasonData[0],
      ["transaction_reason_id"]
    )
  }

  listDiscard = async (c: Context) => {
    return TransactionListDiscardRequestSchema.superRefine(
      async (data, ctx) => {
        const { start_date, end_date } = data

        // check date
        conditionsMessage(
          ctx,
          c.var.t("validator.date", {
            field: c.var.t("common.start_date"),
          }),
          isNaN(new Date(start_date).getTime()),
          [`start_date`]
        )

        conditionsMessage(
          ctx,
          c.var.t("validator.date", {
            field: c.var.t("common.end_date"),
          }),
          isNaN(new Date(end_date).getTime()),
          [`end_date`]
        )

        conditionsMessage(
          ctx,
          c.var.t("validator.end_date_before_start_date"),
          !isNaN(new Date(start_date).getTime()) &&
            !isNaN(new Date(end_date).getTime()) &&
            new Date(start_date) > new Date(end_date),
          [`end_date`]
        )

        // check data id
        this.#checkListDiscardIdIsNaN(c, data, ctx)
        await this.#checkListDiscardIdIsExist(c, data, ctx)
      }
    )
  }

  consumption = async (c: Context) => {
    const userData = await this.repository.findWsUserById(c, c.var.userId!)

    return ConsumptionSchema.extend({
      materials: ConsumptionSchema.shape.materials.superRefine(
        (materials, ctx) => {
          const programId = c.var.programId
          const sets = {
            materialSet: new Set<number>(),
            stockSet: new Set<number>(),
          }

          for (const [idx, material] of materials.entries()) {
            conditionsMessage(
              ctx,
              c.var.t("validator.unique", {
                field: c.var.t("transaction.label.stock_id"),
              }),
              !!getDefaultNumber(material.stock_id) &&
                sets.stockSet.has(getDefaultNumber(material.stock_id)),
              [`materials.${idx}.stock_id`]
            )

            sets.materialSet.add(getDefaultNumber(material.material_id))
            sets.stockSet.add(getDefaultNumber(material.stock_id))
          }

          return Promise.all([
            this.repository.findWsMaterialByIds(
              c,
              Array.from(sets.materialSet),
              programId
            ),
            this.repository.findWsMaterialPermissonByIds(
              c,
              Array.from(sets.materialSet)
            ),
            this.repository.findWsStockByIds(
              c,
              Array.from(sets.stockSet),
              programId,
              false
            ),
          ]).then(([materialsData, materialsPermissonData, stockData]) => {
            const materialAssociate = associate(materialsData, "id")
            const stockAssociate = associate(stockData, "id")

            for (const [idx, material] of materials.entries()) {
              this.#checkMaterialInStock(
                idx,
                c,
                ctx,
                stockAssociate,
                material.stock_id,
                material.material_id
              )

              this.#checkMaterialWithoutStockQuality(
                c,
                ctx,
                idx,
                userData,
                material,
                materialAssociate,
                materialsPermissonData
              )

              this.#checkQtyStock(c, ctx, idx, material, stockAssociate)
            }
          })
        }
      ),
    }).superRefine(async (data, ctx) => {
      const programId = c.var.programId
      const [entityData, activityData, customerData, entityActivityData] =
        await Promise.all([
          this.repository.findWsEntityById(c, data.entity_id, programId),
          this.activityRepo.findById(c, data.activity_id, programId),
          this.repository.findWsEntityById(c, data.customer_id, programId),
          this.entityActivityRepo.getListEntityActivity(
            c,
            data.entity_id,
            {
              is_ongoing: 1,
              page: 1,
              paginate: 100,
              offset: 0,
            },
            programId
          ),
        ])

      const hasActivity = entityActivityData.some(
        (activity) => activity.id === data.activity_id
      )

      conditionsMessage(
        ctx,
        c.var.t("validator.not_exist", {
          field: c.var.t("transaction.label.entity_id"),
        }),
        !entityData,
        ["entity_id"]
      )
      conditionsMessage(
        ctx,
        c.var.t("validator.not_exist", {
          field: c.var.t("transaction.label.activity_id"),
        }),
        !activityData,
        ["activity_id"]
      )
      conditionsMessage(
        ctx,
        c.var.t("validator.not_exist", {
          field: c.var.t("transaction.label.entity_id"),
        }),
        !customerData,
        ["customer_id"]
      )
      conditionsMessage(
        ctx,
        c.var.t("validator.entity_activity_date_not_active", {
          field: c.var.t("transaction.label.activity_id"),
        }),
        !hasActivity,
        ["activity_id"]
      )
    })
  }

  cancelationDiscard = async (c: Context) => {
    return CancelationDiscardSchema.superRefine(async (data, ctx) => {
      const programId = c.var.programId
      const { transactions, entity_id, activity_id } = data
      const [entityData, activityData] = await Promise.all([
        this.repository.findWsEntityById(c, entity_id, programId),
        this.activityRepo.findById(c, activity_id, programId),
      ])

      const sets = {
        transactionSet: new Set<number>(),
        stockSet: new Set<number>(),
        transactionReasonSet: new Set<number>(),
      }

      conditionsMessage(
        ctx,
        c.var.t("validator.not_exist", {
          field: c.var.t("transaction.label.entity_id"),
        }),
        !entityData,
        ["entity_id"]
      )

      conditionsMessage(
        ctx,
        c.var.t("validator.not_exist", {
          field: c.var.t("transaction.label.activity_id"),
        }),
        !activityData,
        ["activity_id"]
      )

      for (const [idx, transaction] of transactions.entries()) {
        conditionsMessage(
          ctx,
          c.var.t("validator.unique", {
            field: c.var.t("transaction.label.stock_id"),
          }),
          !!getDefaultNumber(transaction.stock_id) &&
            sets.stockSet.has(getDefaultNumber(transaction.stock_id)),
          [`transactions.${idx}.stock_id`]
        )

        transaction.transaction_ids.forEach((id) => {
          sets.transactionSet.add(getDefaultNumber(id))
        })
        sets.stockSet.add(getDefaultNumber(transaction.stock_id))
        sets.transactionReasonSet.add(
          getDefaultNumber(transaction.transaction_reason_id)
        )
      }

      await Promise.all([
        this.repository.findWsTransactionByIds(
          c,
          Array.from(sets.transactionSet).length
            ? Array.from(sets.transactionSet)
            : [0],
          programId,
          TRANSACTION_TYPE.DISCARDS,
          activity_id,
          true
        ),
        this.repository.findWsStockByIds(
          c,
          Array.from(sets.stockSet),
          programId,
          false
        ),
        this.repository.findWsTransactionReasonByIds(
          c,
          Array.from(sets.transactionReasonSet),
          TRANSACTION_TYPE.CANCEL_DISCARD
        ),
      ]).then(([transactionData, stockData, transactionReasonData]) => {
        const transactionAssociate = associate(transactionData, "id")
        const stockAssociate = associate(stockData, "id")
        const transactionReasonAssociate = associate(
          transactionReasonData,
          "id"
        )

        for (const [idx, transaction] of transactions.entries()) {
          for (const [idxId, id] of transaction.transaction_ids.entries()) {
            conditionsMessage(
              ctx,
              c.var.t("validator.number", {
                field: c.var.t("transaction.label.transaction_id"),
              }),
              isNaN(Number(id)),
              [`transactions.${idx}.transaction_ids.${idxId}`]
            )

            conditionsMessage(
              ctx,
              c.var.t("validator.greater_than", {
                field1: c.var.t("transaction.label.transaction_id"),
                field2: 0,
              }),
              getDefaultNumber(id) < 1,
              [`transactions.${idx}.transaction_ids.${idxId}`]
            )

            conditionsMessage(
              ctx,
              c.var.t("validator.not_exist", {
                field: c.var.t("transaction.label.transaction_id"),
              }),
              !transactionAssociate[getDefaultNumber(id)],
              [`transactions.${idx}.transaction_ids.${idxId}`]
            )
          }

          conditionsMessage(
            ctx,
            c.var.t("validator.number", {
              field: c.var.t("transaction.label.stock_id"),
            }),
            isNaN(Number(transaction.stock_id)),
            [`transactions.${idx}.stock_id`]
          )

          conditionsMessage(
            ctx,
            c.var.t("validator.greater_than", {
              field1: c.var.t("transaction.label.stock_id"),
              field2: 0,
            }),
            getDefaultNumber(transaction.stock_id) < 1,
            [`transactions.${idx}.stock_id`]
          )

          conditionsMessage(
            ctx,
            c.var.t("validator.not_exist", {
              field: c.var.t("transaction.label.stock_id"),
            }),
            !stockAssociate[getDefaultNumber(transaction.stock_id)],
            [`transactions.${idx}.stock_id`]
          )

          conditionsMessage(
            ctx,
            c.var.t("validator.number", {
              field: c.var.t("transaction.label.transaction_reason_id"),
            }),
            isNaN(Number(transaction.transaction_reason_id)),
            [`transactions.${idx}.transaction_reason_id`]
          )

          conditionsMessage(
            ctx,
            c.var.t("validator.greater_than", {
              field1: c.var.t("transaction.label.transaction_reason_id"),
              field2: 0,
            }),
            getDefaultNumber(transaction.transaction_reason_id) < 1,
            [`transactions.${idx}.transaction_reason_id`]
          )

          conditionsMessage(
            ctx,
            c.var.t("validator.not_exist", {
              field: c.var.t("transaction.label.transaction_reason_id"),
            }),
            !transactionReasonAssociate[
              getDefaultNumber(transaction.transaction_reason_id)
            ],
            [`transactions.${idx}.transaction_reason_id`]
          )
        }
      })
    })
  }

  logErrors = createMiddleware(async (c, next) => {
    await next()
    if (c.var.errors) {
      const errors = c.var.errors as { [key: string]: string[] }
      const errorArrayProperty = this.#determineErrorArrayProperty(errors)
      const errorMaterial = this.#processErrorMaterials(errors)
      const errorResponse = this.#buildErrorResponse(
        errors,
        errorArrayProperty,
        errorMaterial
      )
      c.set("errors", errorResponse)
      throw new ValidationError()
    }
  })

  #determineErrorArrayProperty(errors: { [key: string]: string[] }): string {
    return Object.keys(errors).some((key) => key.startsWith("transactions"))
      ? "transactions"
      : "materials"
  }

  #processErrorMaterials(errors: { [key: string]: string[] }): {
    [key: string]: any
  } {
    const { materials = {}, ...otherMaterials } = errors
    for (const material of Object.keys(otherMaterials)) {
      if (materials[material]) {
        materials[material] = [
          ...materials[material],
          ...(otherMaterials[material] || []),
        ]
      } else {
        materials[material] = otherMaterials[material]
      }
    }
    return this.#organizeErrorMaterials(materials)
  }

  #organizeErrorMaterials(materials: { [key: string]: string[] }): {
    [key: string]: any
  } {
    const errorMaterial = {}
    for (const key of Object.keys(materials)) {
      const keySplit = key.split(".")
      const [_, idx, field1, field2] = keySplit
      if (keySplit.length === 1) {
        errorMaterial[key] = materials[key]
      } else {
        if (!errorMaterial[idx!]) errorMaterial[idx!] = {}
        if (field2) {
          if (!errorMaterial[idx!][field1]) errorMaterial[idx!][field1] = {}
          errorMaterial[idx!][field1][field2] = materials[key]
        } else {
          errorMaterial[idx!][field1] = materials[key]
        }
      }
    }
    return errorMaterial
  }

  #buildErrorResponse(
    errors: { [key: string]: string[] },
    errorArrayProperty: string,
    errorMaterial: { [key: string]: any }
  ): { [key: string]: any } {
    const { entity_id, activity_id, entity_activity_id } = errors
    return {
      entity_id,
      activity_id,
      entity_activity_id,
      ...(Object.keys(errorMaterial).length > 0
        ? { [errorArrayProperty]: errorMaterial }
        : {}),
    }
  }

  #validateLimitReturnedQty(
    c: Context,
    trx: TrxReturnedQty,
    index: number,
    item: TrxSubmitReturnOfHealth
  ) {
    const { qty, isTrxRabies } = item

    if (isTrxRabies && Math.abs(trx.change_qty) !== qty) {
      c.addError(
        `${index}`,
        "validator.submit_return_invalid_returned_qty_rabies"
      )
    }

    const maxReturn =
      Math.abs(trx.change_qty) - (trx.returned_qty + trx.qty_in_vial)
    if (qty > maxReturn) {
      c.addError(`${index}`, "validator.submit_return_qty_exceed_limit")
    }
  }

  #validateTrxPatientRabiesSequence(
    c: Context,
    item: TrxSubmitReturnOfHealth,
    listPatientRabies: ListTrxPatientRabies[],
    listTrxPatientRabies: ListTrxPatientRabies[],
    index: number
  ) {
    const patientRabies = listPatientRabies.find(
      (val) => val.transaction_id === item.transaction_id
    )
    const filteredListTrxPatientRabies = listTrxPatientRabies.filter(
      (val) => val.patient_id === patientRabies?.patient_id
    )

    if (filteredListTrxPatientRabies.length > 0) {
      item.isTrxRabies = true
      if (filteredListTrxPatientRabies.length > 1) {
        const idxPatientRabies = filteredListTrxPatientRabies.findIndex(
          (val) => val.transaction_id === item.transaction_id
        )

        if (idxPatientRabies !== 0) {
          c.addError(
            `${index}`,
            "validator.submit_return_invalid_returned_rabies_sequence"
          )
        } else if (
          filteredListTrxPatientRabies[idxPatientRabies + 1]?.transaction_id
        ) {
          item.prevTrxRabiesSequence =
            filteredListTrxPatientRabies[idxPatientRabies + 1]!.transaction_id
        }
      }
    }
  }

  #validateOpenVialRequest(
    c: Context,
    index: number,
    item: TrxSubmitReturnOfHealth,
    trx: TrxReturnedQty
  ) {
    const { open_vial, close_vial } = item
    const {
      returned_qty,
      change_qty,
      qty_in_vial,
      consumption_unit_per_distribution_unit,
    } = trx
    if (open_vial > 0) {
      const limit =
        Math.abs(change_qty) -
        (returned_qty + qty_in_vial) -
        consumption_unit_per_distribution_unit
      if (close_vial > limit) {
        c.addError(
          `${index}`,
          "validator.submit_return_close_vial_exceed_limit_open_vial"
        )
      }

      if (open_vial >= consumption_unit_per_distribution_unit) {
        c.addError(`${index}`, "validator.submit_return_invalid_open_vial")
      } else {
        item.openVialQty = consumption_unit_per_distribution_unit
      }
    }
  }

  #validateCloseVialRequest(
    c: Context,
    index: number,
    item: TrxSubmitReturnOfHealth,
    trx: TrxReturnedQty
  ) {
    const { close_vial } = item
    const {
      returned_qty,
      change_qty,
      qty_in_vial,
      consumption_unit_per_distribution_unit,
    } = trx

    const maxReturn = Math.abs(change_qty) - (returned_qty + qty_in_vial)
    if (close_vial > 0 && close_vial > maxReturn) {
      c.addError(`${index}`, "validator.submit_return_close_vial_exceed_limit")
    }

    if (
      close_vial > 0 &&
      close_vial % consumption_unit_per_distribution_unit !== 0
    ) {
      c.addError(
        `${index}`,
        "validator.submit_return_close_vial_not_multiple_per_unit"
      )
    }
  }

  #validateBrokenCloseVialRequest(
    c: Context,
    index: number,
    item: TrxSubmitReturnOfHealth,
    trx: TrxReturnedQty
  ) {
    const { close_vial, broken_close_vial } = item
    const { consumption_unit_per_distribution_unit } = trx

    if (broken_close_vial > 0 && broken_close_vial > close_vial) {
      c.addError(
        `${index}`,
        "validator.submit_return_broken_close_vial_exceed_close_vial"
      )
    }

    if (
      broken_close_vial > 0 &&
      broken_close_vial % consumption_unit_per_distribution_unit !== 0
    ) {
      c.addError(
        `${index}`,
        "validator.submit_return_broken_close_vial_not_multiple_per_unit"
      )
    }
  }

  #validateBrokenOpenVialRequest(
    c: Context,
    index: number,
    item: TrxSubmitReturnOfHealth
  ) {
    const { open_vial, broken_open_vial } = item

    if (broken_open_vial > 0 && broken_open_vial > open_vial) {
      c.addError(
        `${index}`,
        "validator.submit_return_broken_open_vial_exceed_open_vial"
      )
    }
  }

  #validateTrxOpenVial(
    c: Context,
    index: number,
    item: TrxSubmitReturnOfHealth,
    trx: TrxReturnedQty,
    canOpenVial: boolean
  ) {
    if ((!!item.open_vial || item.open_vial > 0) && !canOpenVial) {
      c.addError(`${index}`, "validator.submit_return_cannot_open_vial")
    }
    this.#validateOpenVialRequest(c, index, item, trx)
    this.#validateCloseVialRequest(c, index, item, trx)
    this.#validateBrokenCloseVialRequest(c, index, item, trx)
    this.#validateBrokenOpenVialRequest(c, index, item)
  }

  async #validateSequenceConsumption(
    c: Context,
    index: number,
    transactionId: number,
    changeQty?: number
  ) {
    const consumption = await this.repository.getConsumptionByTransactionId(
      c,
      transactionId
    )

    if (
      consumption &&
      consumption.patient_id &&
      consumption.protocol_id &&
      consumption.vaccine_sequence_id
    ) {
      if (changeQty != consumption.actual_qty) {
        c.addError(
          `${index}`,
          "validator.transaction_return_invalid_consumption_qty"
        )
      }

      // check if there is any consumption with higher sequence already exist
      const higherSequenceConsumption =
        await this.repository.getHigherSequenceConsumption(
          c,
          consumption.id,
          consumption.protocol_id,
          consumption.patient_id
        )

      if (higherSequenceConsumption) {
        c.addError(
          `${index}`,
          "validator.transaction_return_invalid_sequence_consumption"
        )
      }
    }
  }

  submitReturnOfHealth = async (
    c: Context,
    body: SubmitReturnOfHealthFacilitiesRequest
  ) => {
    const listTrxID = body.transactions.map((item) => item.transaction_id)
    const customerID = body.customer_id
    const entityId = body.entity_id
    const activityId = body.activity_id
    const entityActivityId = body.entity_activity_id as number
    const programId = c.var.programId
    const stockID = body.transactions.map((item) => item.stock_id)
    const actualTransactionDate = body.actual_transaction_date

    const [
      listTrx,
      listPatientRabies,
      entityTrx,
      materialStockTrx,
      customerVendorActivityTrx,
    ] = await Promise.all([
      this.repository.findTransactionList(c, listTrxID),
      this.repository.getListPatientConsumption(c, listTrxID),
      this.repository.getEntityById(c, customerID),
      this.repository.getMaterialByStockIds(c, stockID),
      this.repository.findEntityActivityVendorCustomerEntityByIds(
        c,
        programId,
        entityId,
        customerID,
        entityActivityId,
        activityId
      ),
    ])

    if (!customerVendorActivityTrx) {
      c.addError("entity_activity_id", "validator.not_exist")
    }

    const actualTransactionDateStrTime = new Date(actualTransactionDate)
    const nowStrTime = new Date()

    if (actualTransactionDateStrTime > nowStrTime) {
      c.addError(
        "actual_transaction_date",
        "validator.actual_transaction_date_must_be_today_or_earlier"
      )
    }

    const canOpenVial =
      Number(entityTrx?.is_open_vial) === 1 &&
      Number(materialStockTrx?.is_open_vial) === 1

    // Validate for rabies return of health facilities only
    const listPatient = listPatientRabies.map((item) => item.patient_id)
    let listTrxPatientRabies: ListTrxPatientRabies[] = []
    if (listPatient.length > 0) {
      listTrxPatientRabies = await this.repository.getListTrxByPatientRabies(
        c,
        listPatient
      )
    }

    body.listTrx = listTrx as TrxReturnedQty[]
    for (const [idx, item] of body.transactions.entries()) {
      item.prevTrxRabiesSequence = null
      item.isTrxRabies = false
      item.openVialQty = 0
      const trx = body.listTrx.find((val) => val.id === item.transaction_id)
      if (!trx) {
        c.addError(`${idx}`, "validator.submit_return_invalid_trx_id")
        return
      }

      // Validate Trx Patient Rabies Sequence
      this.#validateTrxPatientRabiesSequence(
        c,
        item,
        listPatientRabies,
        listTrxPatientRabies,
        idx
      )

      // Validate limit returned qty
      this.#validateLimitReturnedQty(c, trx, idx, item)

      // Validate Open Vial
      this.#validateTrxOpenVial(c, idx, item, trx, canOpenVial)

      await this.#validateSequenceConsumption(
        c,
        idx,
        item.transaction_id,
        item.qty
      )
    }

    if (c.var.errors) {
      throw new ValidationError()
    }

    return body
  }

  validateDateRange = createMiddleware(async (c, next) => {
    const { start_date, end_date } = c.req.query()
    if (
      start_date &&
      end_date &&
      moment(start_date).isAfter(moment(end_date))
    ) {
      throw new ValidationError("Invalid Date Range")
    }

    await next()
  })
}
