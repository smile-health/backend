import { KFA_LEVEL_ID } from "@/common/constants/material.js"
import { TOPIC } from "@smile/lib/rabbitmq/topic.js"
import { PaginatedResponse } from "@smile/lib/types/paginate.js"
import { associate, collect, group, pick } from "@smile/lib/utils.js"
import { Context } from "hono"
import _ from "lodash"
import { ActivityRepository } from "../activity/activity.repository.js"
import { BaseModule } from "../base.module.js"
import { EntityRepository } from "../entity/entity.repository.js"
import ExportHistoryRepository from "../export-history/export-history.repository.js"
import { MaterialRepository } from "../material/material.repository.js"
import StockOpnameRepository from "../stock-opname/stock-opname.repository.js"
import { StockPublisher } from "./stock.publisher.js"
import { StockRepository } from "./stock.repository.js"
import { StockNonHierarchyRepository } from "./stock.non-hierarchy.repository.js"
import {
  GetEntityStocksQueries,
  GetListEntityStockQueries,
  GetStockDetailsQueries,
  GetStocksQueries,
} from "./stock.schema.js"
import { StockCron } from "./stock.cron.js"
import { UserRepository } from "../user/user.repository.js"
import { EntityCustomerRepository } from "../entity-customer/entity-customer.repository.js"
import { Publisher } from "@smile/lib/rabbitmq/publisher.js"
import { NotificationTypeRepository } from "@/common/repository/notification-type.js"

export class StockModule extends BaseModule {
  constructor(
    private readonly stockRepo: StockRepository,
    private readonly stockNonHierarchyRepo: StockNonHierarchyRepository,
    private readonly entityRepo: EntityRepository,
    private readonly materialRepo: MaterialRepository,
    private readonly activityRepo: ActivityRepository,
    private readonly stockOpnameRepo: StockOpnameRepository,
    protected readonly exportHistoryRepo: ExportHistoryRepository,
    protected readonly publisher: StockPublisher,
    private readonly userRepo: UserRepository,
    private readonly entityCustomerRepo: EntityCustomerRepository,
    private readonly notificationPublisher: Publisher,
    private readonly notificationTypeRepo: NotificationTypeRepository
  ) {
    super(exportHistoryRepo, publisher)
  }

  async list(c: Context, params: GetStocksQueries) {
    const { data, total } = await this.getStockRepo(c).findAll(c, params)
    if (data.length === 0) {
      return new PaginatedResponse(params)
    }

    const entityIds = collect(data, "entity_id")
    const materialIds = collect(data, "material_id") as number[]
    const entityMaterials = data.map((res) => [
      Number(res.entity_id),
      Number(res.material_id),
    ])

    const [mapEntities, materials, minMax] = await Promise.all([
      this.entityRepo.getBasicDetailMapped(c, entityIds),
      this.materialRepo.findWithDetails(c, materialIds),
      this.getStockRepo(c).findMinMax(
        c,
        entityMaterials,
        params.activity_id ?? undefined
      ),
    ])
    const mapMaterials = associate(materials, "id")

    const isHierarchy =
      (c.var.config?.material.is_hierarchy_enabled &&
        params.material_level_id !== KFA_LEVEL_ID.VARIANT) ??
      false

    const list = await Promise.all(
      data.map(async (res) => {
        const details = await this.details(c, {
          entity_id: res.entity_id ?? 0,
          material_id: !isHierarchy ? res.material_id : null,
          parent_material_id: isHierarchy ? res.material_id : null,
          activity_id: params.activity_id,
          group_by: isHierarchy ? "material" : "activity",
          only_have_qty: params.only_have_qty,
          expired_start_date: params.expired_start_date,
          expired_end_date: params.expired_end_date,
          batch_ids: params.batch_ids,
        })

        let isOpenVial = 0
        details.map((item: { material: { is_open_vial: number } }) => {
          isOpenVial += item.material?.is_open_vial ?? 0
        })
        const material = mapMaterials[res.material_id ?? 0]
        if (material) {
          material.is_open_vial = isOpenVial
        }

        return {
          ...pick(res, [
            "total_qty",
            "total_allocated_qty",
            "total_in_transit_qty",
            "total_unreceived_qty",
            "total_open_vial_qty",
            "total_available_qty",
            "updated_at",
          ]),
          min: minMax[res.entity_id ?? 0]?.[res.material_id ?? 0]?.min ?? 0,
          max: minMax[res.entity_id ?? 0]?.[res.material_id ?? 0]?.max ?? 0,
          entity: mapEntities[res.entity_id ?? 0],
          material,
          ...(params.with_details === 1 && details.length > 0
            ? {
                details,
              }
            : null),
          updated_at: new Date(res.updated_at + "Z").toISOString(),
        }
      })
    )

    return new PaginatedResponse(params, list, total)
  }

  async listByEntity(c: Context, params: GetEntityStocksQueries) {
    const isHierarchy =
      (c.var.config?.material.is_hierarchy_enabled &&
        params.material_level_id !== KFA_LEVEL_ID.VARIANT) ??
      false

    const { data, total } = await this.getStockRepo(c).findEntityMaterials(
      c,
      params
    )
    if (data.length === 0) {
      return new PaginatedResponse(params)
    }

    const materialIds = collect(data, "material_id")
    const stockParams = {
      page: 1,
      paginate: params.paginate,
      offset: 0,
      entity_id: params.entity_id,
      material_id: materialIds,
      material_level_id: params.material_level_id,
      period_id: params.period_id,
    }

    const [aggregates, stocks] = await Promise.all([
      this.getStockRepo(c).findAll(c, stockParams),
      this.getStockRepo(c).findAll(c, {
        ...stockParams,
        activity_id: params.activity_id,
      }),
    ])

    const [entity, materials, protocols, opnameDates] = await Promise.all([
      this.entityRepo.getBasicDetail(c, params.entity_id),
      this.materialRepo.findWithDetails(c, materialIds),
      this.materialRepo.findWithProtocols(c, materialIds, params.activity_id),
      this.stockOpnameRepo.getOpnameDates(
        c,
        params.entity_id,
        params.period_id,
        isHierarchy
      ),
    ])

    const mapMaterials = associate(materials, "id")
    const mapStock = associate(stocks.data, "material_id")
    const mapAggregate = associate(aggregates.data, "material_id")

    const list = await Promise.all(
      data.map(async (res) => {
        const stock = mapStock[res.material_id ?? 0] as (typeof stocks.data)[0]
        const aggregate = mapAggregate[
          res.material_id ?? 0
        ] as (typeof aggregates.data)[0]

        return {
          total_qty: stock?.total_qty ?? 0,
          total_allocated_qty: stock?.total_allocated_qty ?? 0,
          total_in_transit_qty: stock?.total_in_transit_qty ?? 0,
          total_unreceived_qty: stock?.total_unreceived_qty ?? 0,
          total_open_vial_qty: stock?.total_open_vial_qty ?? 0,
          total_available_qty: stock?.total_available_qty ?? 0,
          updated_at: stock?.updated_at ?? null,
          last_opname_date: params.period_id
            ? (opnameDates[res.material_id ?? 0] ?? null)
            : null,
          min: res.min,
          max: res.max,
          aggregate: {
            total_qty: aggregate?.total_qty ?? 0,
            total_allocated_qty: aggregate?.total_allocated_qty ?? 0,
            total_in_transit_qty: aggregate?.total_in_transit_qty ?? 0,
            total_unreceived_qty: aggregate?.total_unreceived_qty ?? 0,
            total_open_vial_qty: aggregate?.total_open_vial_qty ?? 0,
            total_available_qty: aggregate?.total_available_qty ?? 0,
            updated_at: aggregate?.updated_at ?? null,
            min: res.min,
            max: res.max,
          },
          entity: entity,
          material: mapMaterials[res.material_id ?? 0],
          activity: params.activity_id
            ? {
                id: params.activity_id,
                name:
                  mapMaterials[res.material_id ?? 0]?.activities?.find(
                    (a) => a.id === params.activity_id
                  )?.name ?? null,
              }
            : null,
          protocol: protocols[res.material_id ?? 0] ?? null,
          ...(params.with_details
            ? {
                details: await this.details(c, {
                  entity_id: res.entity_id ?? 0,
                  material_id: isHierarchy ? null : res.material_id,
                  parent_material_id: isHierarchy ? res.material_id : null,
                  activity_id: isHierarchy ? params.activity_id : null,
                  group_by: isHierarchy ? "material" : "activity",
                  only_have_qty: params.only_have_qty,
                  period_id: params.period_id,
                }),
              }
            : null),
        }
      })
    )

    return new PaginatedResponse(params, list, total)
  }

  async listByEntitySort(c: Context, params: GetEntityStocksQueries) {
    const isHierarchy =
      (c.var.config?.material.is_hierarchy_enabled &&
        params.material_level_id !== KFA_LEVEL_ID.VARIANT) ??
      false

    const {
      data,
      total,
    }: {
      data: any[]
      total: any
    } = await this.getStockRepo(c).findEntityMaterialsSort(c, params)

    if (data.length === 0) {
      return new PaginatedResponse(params)
    }

    const materialIds = collect(data, "material_id")
    const stockParams = {
      page: 1,
      paginate: params.paginate,
      offset: 0,
      entity_id: params.entity_id,
      material_id: materialIds,
      material_level_id: params.material_level_id,
      period_id: params.period_id,
    }

    const [aggregates] = await Promise.all([
      this.getStockRepo(c).findAll(c, stockParams),
      // this.getStockRepo(c).findAll(c, {
      //   ...stockParams,
      //   activity_id: params.activity_id,
      // }),
    ])

    const [entity, materials, protocols, opnameDates] = await Promise.all([
      this.entityRepo.getBasicDetail(c, params.entity_id),
      this.materialRepo.findWithDetails(c, materialIds),
      this.materialRepo.findWithProtocols(c, materialIds, params.activity_id),
      this.stockOpnameRepo.getOpnameDates(
        c,
        params.entity_id,
        params.period_id,
        isHierarchy
      ),
    ])

    const mapMaterials = associate(materials, "id")
    // const mapStock = associate(stocks.data, "material_id")
    const mapAggregate = associate(aggregates.data, "material_id")

    const list = await Promise.all(
      data.map(async (res) => {
        // const stock = mapStock[res.material_id ?? 0] as (typeof stocks.data)[0]
        const aggregate = mapAggregate[
          res.material_id ?? 0
        ] as (typeof aggregates.data)[0]

        return {
          total_qty: res?.total_qty ?? 0,
          total_allocated_qty: res?.total_allocated_qty ?? 0,
          total_in_transit_qty: res?.total_in_transit_qty ?? 0,
          total_unreceived_qty: res?.total_unreceived_qty ?? 0,
          total_open_vial_qty: res?.total_open_vial_qty ?? 0,
          total_available_qty: res?.total_available_qty ?? 0,
          updated_at: res?.updated_at ?? null,
          last_opname_date: params.period_id
            ? (opnameDates[res.material_id ?? 0] ?? null)
            : null,
          min: res.min,
          max: res.max,
          aggregate: {
            total_qty: aggregate?.total_qty ?? 0,
            total_allocated_qty: aggregate?.total_allocated_qty ?? 0,
            total_in_transit_qty: aggregate?.total_in_transit_qty ?? 0,
            total_unreceived_qty: aggregate?.total_unreceived_qty ?? 0,
            total_open_vial_qty: aggregate?.total_open_vial_qty ?? 0,
            total_available_qty: aggregate?.total_available_qty ?? 0,
            updated_at: aggregate?.updated_at ?? null,
            min: res.min,
            max: res.max,
          },
          entity: entity,
          material: mapMaterials[res.material_id ?? 0],
          activity: params.activity_id
            ? {
                id: params.activity_id,
                name:
                  mapMaterials[res.material_id ?? 0]?.activities?.find(
                    (a) => a.id === params.activity_id
                  )?.name ?? null,
              }
            : null,
          protocol: protocols[res.material_id ?? 0] ?? null,
          ...(params.with_details
            ? {
                details: await this.details(c, {
                  entity_id: res.entity_id ?? 0,
                  material_id: isHierarchy ? null : res.material_id,
                  parent_material_id: isHierarchy ? res.material_id : null,
                  activity_id: isHierarchy ? params.activity_id : null,
                  group_by: isHierarchy ? "material" : "activity",
                  only_have_qty: params.only_have_qty,
                  period_id: params.period_id,
                }),
              }
            : null),
        }
      })
    )

    return new PaginatedResponse(params, list, total)
  }

  async details(c: Context, params: GetStockDetailsQueries) {
    if (params.group_by === "activity_material") {
      const activities = await this.getStockRepo(c).findActivities(
        c,
        params.entity_id,
        params.parent_material_id ?? params.material_id ?? 0
      )
      return await Promise.all(
        activities.map(async (activity) => {
          return {
            activity: activity,
            details: await this.details(c, {
              ...params,
              group_by: "material",
              activity_id: activity.id,
            }),
          }
        })
      )
    }

    const stocks = await this.getStockRepo(c).findDetails(c, params)
    if (stocks.length === 0) {
      return []
    }

    const [materials, activities, opnameDates] = await Promise.all([
      this.materialRepo.findWithDetails(c, collect(stocks, "material_id")),
      this.activityRepo
        .find(c, {
          id: collect(stocks, "activity_id"),
        })
        .then((res) => res.map((activity) => pick(activity, ["id", "name"]))),
      this.stockOpnameRepo.getOpnameDates(
        c,
        params.entity_id,
        params.period_id
      ),
    ])

    const mapStocks =
      params.group_by === "activity"
        ? group(stocks, "activity_id")
        : group(stocks, "material_id")
    const mapMaterials = associate(materials, "id")
    const mapActivities = associate(activities, "id")

    return Object.entries(mapStocks).map(([id, stocks]) => ({
      activity: params.group_by === "activity" ? mapActivities[id] : null,
      material: params.group_by === "material" ? mapMaterials[id] : null,
      total_qty: _.sumBy(stocks, "qty") ?? 0,
      total_allocated_qty: _.sumBy(stocks, "allocated_qty") ?? 0,
      total_in_transit_qty: _.sumBy(stocks, "in_transit_qty") ?? 0,
      total_unreceived_qty: _.sumBy(stocks, "unreceived_qty") ?? 0,
      total_open_vial_qty: _.sumBy(stocks, "open_vial_qty") ?? 0,
      total_available_qty: _.sumBy(stocks, "available_qty") ?? 0,
      min: _.maxBy(stocks, "min")?.min,
      max: _.maxBy(stocks, "max")?.max,
      updated_at: _.maxBy(stocks, "updated_at")?.updated_at,
      last_opname_date: params.period_id
        ? (opnameDates[id ?? 0] ?? null)
        : null,
      stocks: stocks
        .filter((stock) => stock.id)
        .map((stock) => ({
          ...pick(stock, [
            "id",
            "batch",
            "budget_source",
            "qty",
            "allocated_qty",
            "in_transit_qty",
            "unreceived_qty",
            "open_vial_qty",
            "available_qty",
            "price",
            "min",
            "max",
            "total_price",
            "year",
            "updated_at",
          ]),
          activity: mapActivities[stock.activity_id ?? 0],
        })),
    })).sort((a, b) => b.total_qty - a.total_qty)
  }

  async export(c: Context, params: GetStocksQueries) {
    params.program_id = c.var.programId

    return await this.handleAsyncExport(c, TOPIC.VIEW_STOCK_EXPORTED, {
      filename: c.var.t("common.stock"),
      params,
    })
  }

  private getStockRepo(c: Context) {
    const isHierarchy = c.var.config?.material.is_hierarchy_enabled
    return isHierarchy ? this.stockRepo : this.stockNonHierarchyRepo
  }

  async triggerStockNotification(
    c: Context,
    params: GetListEntityStockQueries,
    isHierarchy = true
  ) {
    const { entity_ids } = params
    const stockCron = new StockCron(
      this.stockRepo,
      this.userRepo,
      this.entityCustomerRepo,
      this.notificationTypeRepo,
      this.notificationPublisher
    )

    await stockCron.handleNotifStock(c, c, c.var.t, isHierarchy, entity_ids)
  }

  async triggerStockExpiredNotification(
    c: Context,
    params: GetListEntityStockQueries
  ) {
    const { entity_ids } = params
    const stockCron = new StockCron(
      this.stockRepo,
      this.userRepo,
      this.entityCustomerRepo,
      this.notificationTypeRepo,
      this.notificationPublisher
    )

    await stockCron.handleNotifEdStock(c, c, c.var.t, entity_ids)
  }
}
