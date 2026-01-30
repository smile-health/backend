import { KFA_LEVEL_ID } from "@/common/constants/material.js"
import { HTTPError } from "@smile-health/lib/error.js"
import { logger } from "@smile-health/lib/logger.js"
import { associate, collect, group, pick } from "@smile-health/lib/utils.js"
import { Context } from "hono"
import _ from "lodash"
import moment from "moment"
import { ActivityRepository } from "../activity/activity.repository.js"
import { BatchRepository } from "../batch/batch.repository.js"
import { BudgetSourceRepository } from "../budget-source/budget-source.repository.js"
import { EntityActivityRepository } from "../entity-activity/entity-activity.repository.js"
import { EntityCustomerRepository } from "../entity-customer/entity-customer.repository.js"
import { EntityMaterialRepository } from "../entity-material/entity-material.repository.js"
import { EntityVendorRepository } from "../entity-vendor/entity-vendor.repository.js"
import { ManufactureRepository } from "../manufacture/manufacture.repository.js"
import { MaterialRepository } from "../material/material.repository.js"
import { OrderRepository } from "../order/order.repository.js"
import { StockRepository } from "../stock/stock.repository.js"
import { TransactionTypeRepository } from "../transaction-type/transaction-type.repository.js"
import {
  ListNotifStockEdDTO,
  ListStockEdNearCombinedDTO,
  WsEntityMaterialActivityDTO,
  WsEntityMaterialStockDTO,
} from "./app-mobile-data.schema.js"

export class AppMobileDataModule {
  constructor(
    private readonly transactionTypeRepo: TransactionTypeRepository,
    private readonly entityCustomerRepo: EntityCustomerRepository,
    private readonly entityVendorRepo: EntityVendorRepository,
    private readonly activityRepo: ActivityRepository,
    private readonly entityActivityRepo: EntityActivityRepository,
    private readonly entityMaterialRepo: EntityMaterialRepository,
    private readonly manufactureRepo: ManufactureRepository,
    private readonly materialRepo: MaterialRepository,
    private readonly stockRepo: StockRepository,
    private readonly batchRepo: BatchRepository,
    private readonly budgetSourceRepo: BudgetSourceRepository,
    private readonly orderRepo: OrderRepository
  ) {}

  async listCustomerVendorActivity(c: Context) {
    try {
      const [customers, vendors, originActivities, activities] =
        await Promise.all([
          this.entityCustomerRepo.getCustomerDistributionConsumptionEntityTag(
            c
          ),
          this.entityVendorRepo.getVendorsEntityTag(c),
          this.activityRepo.getOriginActivities(c),
          this.entityActivityRepo.getActivitiesStartEnd(c),
        ])

      return {
        ...customers.result,
        ...vendors.result,
        ...originActivities.result,
        ...activities.result,
      }
    } catch (error) {
      logger.error(
        `Error fetching customer vendor activity: ${JSON.stringify(error)}`
      )
      throw new HTTPError("Internal server error", 500)
    }
  }

  async listTransactionTypeReasonByWorkspace(c: Context) {
    try {
      const result =
        await this.transactionTypeRepo.getTransactionTypeReasonByWorkspace(c)

      return result?.result.map((val) => {
        return {
          id: val.id,
          title: c.var.t(`transaction.type.${val.id}`),
          change_type: val.change_type,
          enable: val.enable,
          transaction_reasons: val.transaction_reasons.map((reason) => ({
            id: reason.id,
            title: c.var.t(`transaction.reason.${reason.title}`),
            is_other: reason.is_other,
            is_purchase: reason.is_purchase,
          })),
        }
      })
    } catch (error) {
      logger.error(`Error fetching transaction types: ${JSON.stringify(error)}`)
      throw new HTTPError("Internal server error", 500)
    }
  }

  async listMaterialEntityStock(c: Context) {
    try {
      const isKFAEnabled = c.var.config?.material.is_hierarchy_enabled ?? false

      const ema = (await this.entityMaterialRepo.findAppDataMaterial(
        c,
        c.var.entityId ?? 0,
        c.var.programId,
        false,
        isKFAEnabled
      )) as WsEntityMaterialActivityDTO[]
      const materialIds: number[] = [...new Set(collect(ema, "material_id"))]
      const materialNoHaveParentIds: number[] = isKFAEnabled
        ? collect(
            ema.filter(
              (val) =>
                val.parent_id == null &&
                val.material_level_id == KFA_LEVEL_ID.VARIANT
            ),
            "material_id"
          )
        : [-1]
      const {
        entityMaterial,
        associateCalculateMaterialStocks,
        associateCalculateMaterialNoHaveParentStocks,
        mapMaterialActivityMinMax,
        manufactureMaterials,
        materialCompanions,
        groupStock,
        batchs,
        associateBudgetSource,
        activityProtocols,
      } = await this.#getEntityMaterialStock(
        c,
        isKFAEnabled,
        materialIds,
        materialNoHaveParentIds,
        ema
      )

      let materialChildIds: number[] = []
      let entityMaterialHierarchy = {}
      if (isKFAEnabled) {
        const emaChild = await this.entityMaterialRepo.findAppDataMaterial(
          c,
          c.var.entityId ?? 0,
          c.var.programId,
          true
        )
        materialChildIds = [...new Set(collect(emaChild, "material_id"))]
        const getMaterialHierarchy = await this.#getEntityMaterialStock(
          c,
          false,
          materialChildIds,
          [-1],
          emaChild
        )
        const mapMaterialHierarchy = this.#mapEntityMaterialStock({
          ...getMaterialHierarchy,
          entityMaterialHierarchy: {},
        })
        entityMaterialHierarchy = group(mapMaterialHierarchy, "parent_id")
      }

      const resp = this.#mapEntityMaterialStock({
        entityMaterial,
        associateCalculateMaterialStocks,
        associateCalculateMaterialNoHaveParentStocks,
        mapMaterialActivityMinMax,
        manufactureMaterials,
        materialCompanions,
        groupStock,
        batchs,
        associateBudgetSource,
        entityMaterialHierarchy,
        activityProtocols,
      })

      return resp.map((val) => ({
        ...val,
        material_hierarchy: Array.isArray(val.material_hierarchy)
          ? val.material_hierarchy.map((mh) => ({
              ...mh,
              activities: val.activities,
              activityMinMax: val.activityMinMax,
            }))
          : undefined,
      }))

      // FOR DEBUGGING PURPOSE
      // return {
      //   is_kfa_enabled: isKFAEnabled,
      //   program_id: c.var.programId,
      //   entity_id: c.var.entityId,
      //   material_id: materialIds.length,
      //   material_child_ids: materialChildIds.length,
      //   response: resp.length,
      // }
    } catch (error) {
      logger.error(
        `Error fetching material stock entity: ${JSON.stringify(error)}`
      )
      throw new HTTPError("Internal server error", 500)
    }
  }

  async listMaterialActivities(c: Context) {
    try {
      const { isKFAEnabled, ema, materialIds } = await this.dataMaterials(c)

      const { entityMaterial, mapMaterialActivityMinMax } =
        await this.#getMaterialActivities(c, isKFAEnabled, materialIds, ema)

      const resp = this.#mapMaterialActivities({
        entityMaterial,
        mapMaterialActivityMinMax,
      })

      return resp
    } catch (error) {
      logger.error(
        `Error fetching material activities entity: ${JSON.stringify(error)}`
      )
      throw new HTTPError("Internal server error", 500)
    }
  }

  async listMaterialActivityConsumptions(c: Context) {
    try {
      const { isKFAEnabled, materialIds } = await this.dataMaterials(c)

      const { entityMaterial, activityProtocols } =
        await this.#getMaterialActivityConsumptions(
          c,
          isKFAEnabled,
          materialIds
        )

      const resp = this.#mapMaterialActivityConsumptions({
        entityMaterial,
        activityProtocols,
      })

      return resp
    } catch (error) {
      logger.error(
        `Error fetching material consumptions/protocols entity: ${JSON.stringify(error)}`
      )
      throw new HTTPError("Internal server error", 500)
    }
  }

  async listMaterialManufactures(c: Context) {
    try {
      const { isKFAEnabled, materialIds } = await this.dataMaterials(c)

      const { entityMaterial, manufactureMaterials } =
        await this.#getMaterialManufactures(c, isKFAEnabled, materialIds)

      const resp = this.#mapMaterialManufactures({
        entityMaterial,
        manufactureMaterials,
      })

      return resp
    } catch (error) {
      logger.error(
        `Error fetching material manufactures entity: ${JSON.stringify(error)}`
      )
      throw new HTTPError("Internal server error", 500)
    }
  }

  async listMaterialCompanions(c: Context) {
    try {
      const { isKFAEnabled, materialIds } = await this.dataMaterials(c)

      const { entityMaterial, materialCompanions } =
        await this.#getMaterialCompanions(c, isKFAEnabled, materialIds)

      const resp = this.#mapMaterialCompanions({
        entityMaterial,
        materialCompanions,
      })

      return resp
    } catch (error) {
      logger.error(
        `Error fetching material companions entity: ${JSON.stringify(error)}`
      )
      throw new HTTPError("Internal server error", 500)
    }
  }

  async listMaterialHierarchy(c: Context) {
    try {
      const { isKFAEnabled, materialIds } = await this.dataMaterials(c)

      const { entityMaterial } = await this.#getMaterialHierarchy(
        c,
        isKFAEnabled,
        materialIds
      )

      let entityMaterialHierarchy = {}
      if (isKFAEnabled) {
        const { materialIds: materialChildIds } = await this.dataMaterials(
          c,
          true
        )
        const getMaterialHierarchy = await this.#getMaterialHierarchy(
          c,
          false,
          materialChildIds
        )
        const mapMaterialHierarchy = this.#mapMaterialHierarchy({
          ...getMaterialHierarchy,
          entityMaterialHierarchy: {},
        })
        const materialHierarchyIds: number[] = [
          ...new Set(collect(mapMaterialHierarchy, "id")),
        ]

        const [stocks] = await Promise.all([
          isKFAEnabled
            ? this.stockRepo.getEntityMaterialStockHierarchy(
                c,
                c.var.entityId ?? 0,
                materialHierarchyIds
              )
            : [],
        ])

        const groupStock = group(stocks, "material_id")
        const bathcIds = collect(stocks, "batch_id")
        const batchs = await this.batchRepo.getBatchAssociate(c, bathcIds)
        const budgetSources = await this.budgetSourceRepo.find(c, {})
        const associateBudgetSource = associate(budgetSources, "id")

        const resultMap = mapMaterialHierarchy.flatMap((val) => {
          const stocks = groupStock[val?.id] ?? []

          if (stocks.length === 0) {
            return [{ ...val }]
          }

          return {
            ...val,
            material_stocks: stocks.map((stk) => ({
              ...stk,
              stock_id: Number(stk.stock_id),
              material_id: Number(stk.material_id),
              batch_id: Number(stk.batch_id),
              activity_id: Number(stk.activity_id),
              batch: batchs[stk.batch_id ?? 0] ?? {},
              budget_source:
                associateBudgetSource[stk?.budget_source_id ?? 0] ?? {},
            })),
          }
        })

        entityMaterialHierarchy = group(resultMap, "parent_id")
      }

      const resp = this.#mapMaterialHierarchy({
        entityMaterial,
        entityMaterialHierarchy,
      })

      return Array.isArray(resp)
        ? resp.map((val) => ({
            id: val.id,
            material_hierarchy: Array.isArray(val.material_hierarchy)
              ? val.material_hierarchy.map((mh) => ({
                  id: mh.id,
                  material_stocks: mh.material_stocks,
                }))
              : [],
          }))
        : []
    } catch (error) {
      logger.error(
        `Error fetching material hierarchy entity: ${JSON.stringify(error)}`
      )
      throw new HTTPError("Internal server error", 500)
    }
  }

  async listMaterialStocks(c: Context) {
    try {
      const { isKFAEnabled, materialIds, materialNoHaveParentIds } =
        await this.dataMaterials(c)

      const materialStocks = await this.#getMaterialStocks(
        c,
        isKFAEnabled,
        materialIds,
        materialNoHaveParentIds
      )

      const resp = this.#mapMaterialStocks(materialStocks)

      return resp
    } catch (error) {
      logger.error(
        `Error fetching material stocks entity: ${JSON.stringify(error)}`
      )
      throw new HTTPError("Internal server error", 500)
    }
  }

  async dataMaterials(c: Context, isHierarchy: boolean = false) {
    const isKFAEnabled = c.var.config?.material.is_hierarchy_enabled ?? false

    const ema = await this.entityMaterialRepo.findAppDataMaterial(
      c,
      c.var.entityId ?? 0,
      c.var.programId,
      isHierarchy
    )

    const materialIds: number[] = [...new Set(collect(ema, "material_id"))]
    const materialNoHaveParentIds: number[] = isKFAEnabled
      ? collect(
          (
            await this.entityMaterialRepo.findAppDataMaterial(
              c,
              c.var.entityId ?? 0,
              c.var.programId,
              isHierarchy
            )
          ).filter(
            (val) =>
              val.parent_id == null &&
              val.material_level_id == KFA_LEVEL_ID.VARIANT
          ),
          "material_id"
        )
      : [-1]

    return {
      isKFAEnabled,
      ema,
      materialIds,
      materialNoHaveParentIds,
    }
  }

  async listAppNotif(c: Context) {
    const entityId = c.var.entityId ?? 0
    const next30days =
      moment().add(30, "days").format("YYYY-MM-DD") + "23:59:59"

    const stockEd = await this.stockRepo.getStockEd(
      c,
      entityId,
      new Date(next30days)
    )
    const orderNotReceived = await this.orderRepo.getOrderNotReceived(
      c,
      entityId
    )

    const dataNotifStockEd = this.#stockEd(stockEd)
    const dataNotifOrderNotReceived = this.#mapOrderNotReceived(
      orderNotReceived,
      entityId
    )

    return {
      ...dataNotifStockEd,
      ...dataNotifOrderNotReceived,
    }
  }

  async listCvRelocation(c: Context) {
    const cVRelocation =
      await this.entityVendorRepo.getListEntityVendorSameLevel(
        c,
        c.var.userEntity?.id,
        { page: 1, paginate: 10, offset: 0, is_relocation: 1 },
        c.var.programId,
        c.var.userEntity?.country ?? "ID",
        Number(c.var.userEntity?.province_id),
        Number(c.var.userEntity?.regency_id),
        Number(c.var.userEntity?.sub_district_id),
        false
      )

    return cVRelocation.map((entity) => {
      return {
        id: `${entity.id}`,
        name: entity.name ?? "-",
        address: entity.address ?? "-",
        location: entity.location ?? "-",
      }
    })
  }

  async #getEntityMaterialStock(
    c: Context,
    isKFAEnabled: boolean,
    materialIds: number[],
    materialNoHaveParentIds: number[],
    ema: WsEntityMaterialActivityDTO[]
  ) {
    const isMaterialIds = materialIds.length > 0 ? materialIds : [-1]
    const isMaterialNoHaveParentIds =
      materialNoHaveParentIds.length > 0 ? materialNoHaveParentIds : [-1]
    const [
      materials,
      manufactureMaterials,
      materialCompanions,
      stocks,
      calculateMaterialStocks,
      calculateMaterialNoHaveParentStocks,
      mapMaterialActivityMinMax,
      activityProtocols,
    ] = await Promise.all([
      this.entityMaterialRepo.findDynamicMaterial(
        c,
        "id",
        "in",
        isMaterialIds,
        c.var.programId
      ),
      this.manufactureRepo.getMaterialManufactureGroup(c, isMaterialIds),
      this.materialRepo.findMaterialCompanionsGroup(c, isMaterialIds),
      this.stockRepo.getEntityMaterialStockHierarchy(
        c,
        c.var.entityId ?? 0,
        isMaterialIds
      ),
      this.stockRepo.getEntityMaterialCalculateStocks(
        c.var.entityId ?? 0,
        isMaterialIds,
        c.var.programId,
        isKFAEnabled
      ),
      this.stockRepo.getEntityMaterialCalculateStocks(
        c.var.entityId ?? 0,
        isMaterialNoHaveParentIds,
        c.var.programId,
        false
      ),
      this.#getMapMaterialActivityMinMax(ema),
      this.materialRepo.findMaterialProtocols(c, materialIds),
    ])

    const associateCalculateMaterialStocks = associate(
      calculateMaterialStocks,
      "material_id"
    ) as Record<number, WsEntityMaterialStockDTO>
    const associateCalculateMaterialNoHaveParentStocks = associate(
      calculateMaterialNoHaveParentStocks,
      "material_id"
    ) as Record<number, WsEntityMaterialStockDTO>
    const groupStock = group(stocks, "material_id")
    const bathcIds = collect(stocks, "batch_id")
    const batchs = await this.batchRepo.getBatchAssociate(c, bathcIds)
    const budgetSources = await this.budgetSourceRepo.find(c, {})
    const associateBudgetSource = associate(budgetSources, "id")

    const entityMaterial = isKFAEnabled
      ? materials.filter((val) => val.parent_id == null)
      : materials

    return {
      entityMaterial,
      associateCalculateMaterialStocks,
      associateCalculateMaterialNoHaveParentStocks,
      mapMaterialActivityMinMax,
      manufactureMaterials,
      materialCompanions,
      groupStock,
      batchs,
      associateBudgetSource,
      activityProtocols,
    }
  }

  async #getMapMaterialActivityMinMax(ema: WsEntityMaterialActivityDTO[]) {
    const mapMaterialActivityMinMax = new Map<
      string,
      {
        activities: number[]
        activityMinMax: { activity_id: number; min: number; max: number }[]
      }
    >()

    for (const value of ema) {
      const key = `${value.material_id}`
      const existing = mapMaterialActivityMinMax.get(key)

      if (existing) {
        mapMaterialActivityMinMax.set(key, {
          activities: [...existing.activities, value.activity_id],
          activityMinMax: [
            ...existing.activityMinMax,
            {
              activity_id: value.activity_id,
              min: value.min ?? 0,
              max: value.max ?? 0,
            },
          ],
        })
      } else {
        mapMaterialActivityMinMax.set(key, {
          activities: [value.activity_id],
          activityMinMax: [
            {
              activity_id: value.activity_id,
              min: value.min ?? 0,
              max: value.max ?? 0,
            },
          ],
        })
      }
    }

    return mapMaterialActivityMinMax
  }

  #mapEntityMaterialStock({
    entityMaterial,
    associateCalculateMaterialStocks,
    associateCalculateMaterialNoHaveParentStocks,
    mapMaterialActivityMinMax,
    manufactureMaterials,
    materialCompanions,
    groupStock,
    batchs,
    associateBudgetSource,
    entityMaterialHierarchy,
    activityProtocols,
  }) {
    return entityMaterial.map((val) => ({
      ...pick(val, [
        "id",
        "program_id",
        "name",
        "description",
        "code",
        "hierarchy_code",
        "status",
        "is_open_vial",
        "is_addremove",
        "material_level_id",
        "parent_id",
        "unit_of_consumption_id",
        "unit_of_consumption",
        "unit_of_distribution_id",
        "unit_of_distribution",
        "consumption_unit_per_distribution_unit",
        "is_temperature_sensitive",
        "min_retail_price",
        "max_retail_price",
        "min_temperature",
        "max_temperature",
        "material_type_id",
        "material_type",
        "is_managed_in_batch",
        "created_by",
        "updated_by",
        "created_at",
        "updated_at",
      ]),
      min:
        associateCalculateMaterialStocks[val.id]?.min ??
        associateCalculateMaterialNoHaveParentStocks[val.id]?.min ??
        0,
      max:
        associateCalculateMaterialStocks[val.id]?.max ??
        associateCalculateMaterialNoHaveParentStocks[val.id]?.max ??
        0,
      total_qty:
        associateCalculateMaterialStocks[val.id]?.total_qty ??
        associateCalculateMaterialNoHaveParentStocks[val.id]?.total_qty ??
        0,
      total_in_transit_qty:
        associateCalculateMaterialStocks[val.id]?.total_in_transit_qty ??
        associateCalculateMaterialNoHaveParentStocks[val.id]
          ?.total_in_transit_qty ??
        0,
      total_allocated_qty:
        associateCalculateMaterialStocks[val.id]?.total_allocated_qty ??
        associateCalculateMaterialNoHaveParentStocks[val.id]
          ?.total_allocated_qty ??
        0,
      total_open_vial_qty:
        associateCalculateMaterialStocks[val.id]?.total_open_vial_qty ??
        associateCalculateMaterialNoHaveParentStocks[val.id]
          ?.total_open_vial_qty ??
        0,
      total_exterminated_qty:
        associateCalculateMaterialStocks[val.id]?.total_exterminated_qty ??
        associateCalculateMaterialNoHaveParentStocks[val.id]
          ?.total_exterminated_qty ??
        0,
      total_available_qty:
        associateCalculateMaterialStocks[val.id]?.total_available_qty ??
        associateCalculateMaterialNoHaveParentStocks[val.id]
          ?.total_available_qty ??
        0,
      ...mapMaterialActivityMinMax.get(`${val?.id}`),
      activity_protocols: activityProtocols[val?.id] ?? [],
      manufactures: manufactureMaterials[val?.id] ?? [],
      material_companion: materialCompanions[val?.id] ?? [],
      stocks: groupStock[val?.id]
        ? groupStock[val?.id]?.map((value) => ({
            ...value,
            stock_id: Number(value.stock_id),
            material_id: Number(value.material_id),
            batch_id: Number(value.batch_id),
            activity_id: Number(value.activity_id),
            batch: batchs[value.batch_id ?? 0] ?? {},
            budget_source:
              associateBudgetSource[value?.budget_source_id ?? 0] ?? {},
          }))
        : [],
      material_hierarchy: entityMaterialHierarchy[val?.id] ?? null,
    }))
  }

  async #getMaterialActivities(
    c: Context,
    isKFAEnabled: boolean,
    materialIds: number[],
    ema: WsEntityMaterialActivityDTO[]
  ) {
    const isMaterialIds = materialIds.length > 0 ? materialIds : [-1]
    const [materials, mapMaterialActivityMinMax] = await Promise.all([
      this.entityMaterialRepo.findDynamicMaterial(
        c,
        "id",
        "in",
        isMaterialIds,
        c.var.programId
      ),
      this.#getMapMaterialActivityMinMax(ema),
    ])

    const entityMaterial = isKFAEnabled
      ? materials.filter((val) => val.parent_id == null)
      : materials

    return {
      entityMaterial,
      mapMaterialActivityMinMax,
    }
  }

  async #getMaterialActivityConsumptions(
    c: Context,
    isKFAEnabled: boolean,
    materialIds: number[]
  ) {
    const isMaterialIds = materialIds.length > 0 ? materialIds : [-1]
    const [materials, activityProtocols] = await Promise.all([
      this.entityMaterialRepo.findDynamicMaterial(
        c,
        "id",
        "in",
        isMaterialIds,
        c.var.programId
      ),
      this.materialRepo.findMaterialProtocols(c, materialIds),
    ])

    const entityMaterial = isKFAEnabled
      ? materials.filter((val) => val.parent_id == null)
      : materials

    return {
      entityMaterial,
      activityProtocols,
    }
  }

  async #getMaterialManufactures(
    c: Context,
    isKFAEnabled: boolean,
    materialIds: number[]
  ) {
    const isMaterialIds = materialIds.length > 0 ? materialIds : [-1]
    const [materials, manufactureMaterials] = await Promise.all([
      this.entityMaterialRepo.findDynamicMaterial(
        c,
        "id",
        "in",
        isMaterialIds,
        c.var.programId
      ),
      this.manufactureRepo.getMaterialManufactureGroup(c, isMaterialIds),
    ])

    const entityMaterial = isKFAEnabled
      ? materials.filter((val) => val.parent_id == null)
      : materials

    return {
      entityMaterial,
      manufactureMaterials,
    }
  }

  async #getMaterialCompanions(
    c: Context,
    isKFAEnabled: boolean,
    materialIds: number[]
  ) {
    const isMaterialIds = materialIds.length > 0 ? materialIds : [-1]
    const [materials, materialCompanions] = await Promise.all([
      this.entityMaterialRepo.findDynamicMaterial(
        c,
        "id",
        "in",
        isMaterialIds,
        c.var.programId
      ),
      this.materialRepo.findMaterialCompanionsGroup(c, isMaterialIds),
    ])

    const entityMaterial = isKFAEnabled
      ? materials.filter((val) => val.parent_id == null)
      : materials

    return {
      entityMaterial,
      materialCompanions,
    }
  }

  async #getMaterialHierarchy(
    c: Context,
    isKFAEnabled: boolean,
    materialIds: number[]
  ) {
    const isMaterialIds = materialIds.length > 0 ? materialIds : [-1]
    const [materials] = await Promise.all([
      this.entityMaterialRepo.findDynamicMaterial(
        c,
        "id",
        "in",
        isMaterialIds,
        c.var.programId
      ),
    ])

    const entityMaterial = materials
    // isKFAEnabled
    //   ? materials.filter((val) => val.parent_id == null)
    //   : materials

    return {
      entityMaterial,
    }
  }

  async #getMaterialStocks(
    c: Context,
    isKFAEnabled: boolean,
    materialIds: number[],
    materialNoHaveParentIds: number[]
  ) {
    const isMaterialIds = materialIds.length > 0 ? materialIds : [-1]
    const isMaterialNoHaveParentIds =
      materialNoHaveParentIds.length > 0 ? materialNoHaveParentIds : [-1]

    const [
      materials,
      stocks,
      calculateMaterialStocks,
      calculateMaterialNoHaveParentStocks,
    ] = await Promise.all([
      this.entityMaterialRepo.findDynamicMaterial(
        c,
        "id",
        "in",
        isMaterialIds,
        c.var.programId
      ),
      this.stockRepo.getEntityMaterialStockHierarchy(
        c,
        c.var.entityId ?? 0,
        isMaterialIds
      ),
      this.stockRepo.getEntityMaterialCalculateStocks(
        c.var.entityId ?? 0,
        isMaterialIds,
        c.var.programId,
        isKFAEnabled
      ),
      this.stockRepo.getEntityMaterialCalculateStocks(
        c.var.entityId ?? 0,
        isMaterialNoHaveParentIds,
        c.var.programId,
        false
      ),
    ])

    const associateCalculateMaterialStocks = associate(
      calculateMaterialStocks,
      "material_id"
    ) as Record<number, WsEntityMaterialStockDTO>
    const associateCalculateMaterialNoHaveParentStocks = associate(
      calculateMaterialNoHaveParentStocks,
      "material_id"
    ) as Record<number, WsEntityMaterialStockDTO>
    const groupStock = group(stocks, "material_id")
    const bathcIds = collect(stocks, "batch_id")
    const batchs = await this.batchRepo.getBatchAssociate(c, bathcIds)
    const budgetSources = await this.budgetSourceRepo.find(c, {})
    const associateBudgetSource = associate(budgetSources, "id")

    const entityMaterial = isKFAEnabled
      ? materials.filter((val) => val.parent_id == null)
      : materials

    return {
      entityMaterial,
      associateCalculateMaterialStocks,
      associateCalculateMaterialNoHaveParentStocks,
      groupStock,
      batchs,
      associateBudgetSource,
    }
  }

  #mapMaterialActivities({ entityMaterial, mapMaterialActivityMinMax }) {
    return entityMaterial.map((val) => ({
      ...pick(val, ["id"]),
      ...mapMaterialActivityMinMax.get(`${val?.id}`),
    }))
  }

  #mapMaterialActivityConsumptions({ entityMaterial, activityProtocols }) {
    return entityMaterial.map((val) => ({
      ...pick(val, ["id"]),
      activity_protocols: activityProtocols[val?.id] ?? [],
    }))
  }

  #mapMaterialManufactures({ entityMaterial, manufactureMaterials }) {
    return entityMaterial.map((val) => ({
      ...pick(val, ["id"]),
      manufactures: manufactureMaterials[val?.id] ?? [],
    }))
  }

  #mapMaterialCompanions({ entityMaterial, materialCompanions }) {
    return entityMaterial.map((val) => ({
      ...pick(val, ["id"]),
      material_companions: materialCompanions[val?.id] ?? [],
    }))
  }

  #mapMaterialHierarchy({ entityMaterial, entityMaterialHierarchy }) {
    return entityMaterial.map((val) => ({
      ...pick(val, ["id", "parent_id"]),
      material_hierarchy: entityMaterialHierarchy[val?.id] ?? undefined,
    }))
  }

  #mapMaterialStocks({
    entityMaterial,
    associateCalculateMaterialStocks,
    associateCalculateMaterialNoHaveParentStocks,
    groupStock,
    batchs,
    associateBudgetSource,
  }) {
    return entityMaterial.map((val) => ({
      ...pick(val, [
        "id",
        "program_id",
        "name",
        "description",
        "code",
        "hierarchy_code",
        "status",
        "is_open_vial",
        "is_addremove",
        "material_level_id",
        "parent_id",
        "unit_of_consumption_id",
        "unit_of_consumption",
        "unit_of_distribution_id",
        "unit_of_distribution",
        "consumption_unit_per_distribution_unit",
        "is_temperature_sensitive",
        "min_retail_price",
        "max_retail_price",
        "min_temperature",
        "max_temperature",
        "material_type_id",
        "material_type",
        "is_managed_in_batch",
        "created_by",
        "updated_by",
        "created_at",
        "updated_at",
      ]),
      min:
        associateCalculateMaterialStocks[val.id]?.min ??
        associateCalculateMaterialNoHaveParentStocks[val.id]?.min ??
        0,
      max:
        associateCalculateMaterialStocks[val.id]?.max ??
        associateCalculateMaterialNoHaveParentStocks[val.id]?.max ??
        0,
      total_qty:
        associateCalculateMaterialStocks[val.id]?.total_qty ??
        associateCalculateMaterialNoHaveParentStocks[val.id]?.total_qty ??
        0,
      total_in_transit_qty:
        associateCalculateMaterialStocks[val.id]?.total_in_transit_qty ??
        associateCalculateMaterialNoHaveParentStocks[val.id]
          ?.total_in_transit_qty ??
        0,
      total_allocated_qty:
        associateCalculateMaterialStocks[val.id]?.total_allocated_qty ??
        associateCalculateMaterialNoHaveParentStocks[val.id]
          ?.total_allocated_qty ??
        0,
      total_open_vial_qty:
        associateCalculateMaterialStocks[val.id]?.total_open_vial_qty ??
        associateCalculateMaterialNoHaveParentStocks[val.id]
          ?.total_open_vial_qty ??
        0,
      total_exterminated_qty:
        associateCalculateMaterialStocks[val.id]?.total_exterminated_qty ??
        associateCalculateMaterialNoHaveParentStocks[val.id]
          ?.total_exterminated_qty ??
        0,
      total_available_qty:
        associateCalculateMaterialStocks[val.id]?.total_available_qty ??
        associateCalculateMaterialNoHaveParentStocks[val.id]
          ?.total_available_qty ??
        0,
      material_stocks: groupStock[val?.id]
        ? groupStock[val?.id]?.map((value) => ({
            ...value,
            stock_id: Number(value.stock_id),
            material_id: Number(value.material_id),
            batch_id: Number(value.batch_id),
            activity_id: Number(value.activity_id),
            batch: batchs[value.batch_id ?? 0] ?? {},
            budget_source:
              associateBudgetSource[value?.budget_source_id ?? 0] ?? {},
          }))
        : [],
    }))
  }

  #stockEd(stockEd) {
    const now = moment().format("YYYY-MM-DD") + "00:00:00"
    const dataNotifStockEd: ListNotifStockEdDTO = {
      stock_ed: {
        total: 0,
        total_material: 0,
        activities: [],
      },
      stock_near_ed: {
        total: 0,
        total_material: 0,
        activities: [],
      },
      stock_combine_ed_near_ed_stock: {
        total: 0,
        total_material: 0,
        activities: [],
      },
    }
    const timeNow = new Date(now).getTime()

    for (const item of stockEd) {
      const batchExpiredDate = new Date(item.batch_expired_date).getTime()

      if (batchExpiredDate <= timeNow) {
        this.#mapStockEd(item, dataNotifStockEd.stock_ed)
      } else {
        this.#mapStockEd(item, dataNotifStockEd.stock_near_ed)
      }
      this.#mapStockEd(item, dataNotifStockEd.stock_combine_ed_near_ed_stock)
    }

    return dataNotifStockEd
  }

  #mapOrderNotReceived(orderNotReceived, entityId: number) {
    const asVendor = orderNotReceived.filter(
      (el) => el.vendor_id == entityId
    ).length
    const asCustomer = orderNotReceived.filter(
      (el) => el.customer_id == entityId
    ).length

    return {
      order_not_received: {
        total: asVendor + asCustomer,
        as_vendor: asVendor,
        as_customer: asCustomer,
      },
    }
  }

  #mapStockEd(itemStockEd, dataNotifStockEd: ListStockEdNearCombinedDTO) {
    const activityIndex = _.findIndex(dataNotifStockEd.activities, {
      activity_id: itemStockEd.activity_id,
    })
    dataNotifStockEd.total += itemStockEd.qty

    if (activityIndex >= 0) {
      dataNotifStockEd.activities[activityIndex]!.total += itemStockEd.qty
      const materialIndex = _.findIndex(
        dataNotifStockEd.activities[activityIndex]!.materials,
        { material_id: itemStockEd.material_id }
      )

      if (materialIndex >= 0) {
        dataNotifStockEd.activities[activityIndex]!.materials[
          materialIndex
        ]!.total += itemStockEd.qty
      } else {
        dataNotifStockEd.total_material += 1
        dataNotifStockEd.activities[activityIndex]!.materials.push({
          material_id: itemStockEd.material_id,
          material_name: itemStockEd.material_name,
          total: itemStockEd.qty,
        })
      }
    } else {
      dataNotifStockEd.total_material += 1
      dataNotifStockEd.activities.push({
        activity_id: itemStockEd.activity_id,
        activity_name: itemStockEd.activity_name,
        total: itemStockEd.qty,
        materials: [
          {
            material_id: itemStockEd.material_id,
            material_name: itemStockEd.material_name,
            total: itemStockEd.qty,
          },
        ],
      })
    }
  }
}
