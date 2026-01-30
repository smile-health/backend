import { Context } from "hono"
import _ from "lodash"
import {
  GetListActivityQueries,
  GetListProgramQueries,
  GetListStockQueries,
  ProgramDetailDTO,
} from "./transfer-stock.schema.js"
import { TransferStockRepository } from "./transfer-stock.repository.js"
import { EntityRepository } from "../entity/entity.repository.js"
import { PaginatedResponse } from "@smile-health/lib/types/paginate.js"
import { associate, collect, pick, group } from "@smile-health/lib/utils.js"
import { StockRepository } from "../stock/stock.repository.js"
import { ActivityRepository } from "../activity/activity.repository.js"
import { GetStockDetailsQueries } from "../stock/stock.schema.js"
import { MaterialRepository } from "../material/material.repository.js"

export class TransferStockModule {
  constructor(
    private readonly repository: TransferStockRepository,
    private readonly entityRepo: EntityRepository,
    private readonly stockRepo: StockRepository,
    private readonly activityRepo: ActivityRepository,
    private readonly materialRepo: MaterialRepository
  ) {}

  readonly #details = async (c: Context, params: GetStockDetailsQueries) => {
    const stocks = await this.stockRepo.findDetails(c, params)
    if (stocks.length === 0) {
      return []
    }

    const activities = await this.activityRepo
      .find(c, {
        id: collect(stocks, "activity_id"),
      })
      .then((res) => res.map((activity) => pick(activity, ["id", "name"])))

    const mapStocks = group(stocks, "activity_id")
    const mapActivities = associate(activities, "id")

    return Object.entries(mapStocks).map(([id, stocks]) => ({
      activity: mapActivities[id],
      total_qty: _.sumBy(stocks, "qty") ?? 0,
      total_allocated_qty: _.sumBy(stocks, "allocated_qty") ?? 0,
      total_in_transit_qty: _.sumBy(stocks, "in_transit_qty") ?? 0,
      total_unreceived_qty: _.sumBy(stocks, "unreceived_qty") ?? 0,
      total_open_vial_qty: _.sumBy(stocks, "open_vial_qty") ?? 0,
      total_available_qty: _.sumBy(stocks, "available_qty") ?? 0,
      min: _.maxBy(stocks, "min")?.min,
      max: _.maxBy(stocks, "max")?.max,
      updated_at: _.maxBy(stocks, "updated_at")?.updated_at,
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
    }))
  }

  async listPrograms(c: Context, params: GetListProgramQueries) {
    const { programId, config } = c.var
    const { entity_id } = params
    const entity = await this.entityRepo.findOne(c, {
      id: entity_id,
    })
    const list = await this.repository.getListProgram(
      c,
      params,
      entity?.global_id ?? 0
    )

    let result: ProgramDetailDTO[] = []
    if (config) {
      result = list
        .filter(
          (item) =>
            (
              item.config as unknown as {
                material: { is_hierarchy_enabled: boolean }
              }
            )?.material?.is_hierarchy_enabled ===
              config.material?.is_hierarchy_enabled && item.id !== programId // Exclude program itself
        )
        .map((item) => {
          return {
            id: item.id,
            key: item.key,
            name: item.name,
            color: (item.config as unknown as { color: string | null })?.color,
          }
        })
    }

    return result
  }

  async listActivity(c: Context, params: GetListActivityQueries) {
    const { material_id, destination_program_id } = params
    const materialGlobal = await this.materialRepo.findOne(c, {
      id: material_id,
    })
    const material = await this.materialRepo.findOne(c, {
      global_id: materialGlobal?.global_id ?? 0,
      program_id: destination_program_id,
    })

    const list = await this.repository.getListActivity(
      c,
      params,
      material?.id ?? 0
    )

    return list
  }

  async listStock(c: Context, params: GetListStockQueries) {
    const { programId } = c.var
    const { entity_id, with_details, destination_program_id } = params
    const { list, total } = await this.repository.getListEntityMaterials(
      c,
      params,
      programId,
      destination_program_id
    )

    if (list.length === 0) {
      return new PaginatedResponse(params)
    }

    const materialIds = collect(list, "material_id")
    const [listStock, entityDetail] = await Promise.all([
      this.repository.getListStock(c, programId, params, materialIds),
      this.entityRepo.getBasicDetail(c, entity_id),
    ])
    const mapStock = associate(listStock, "material_id")

    const response = await Promise.all(
      list.map(async (item) => {
        const stock = mapStock[item.material_id] as (typeof listStock)[0]
        const aggregate = {
          total_qty: stock?.total_qty ?? 0,
          total_allocated_qty: stock?.total_allocated_qty ?? 0,
          total_in_transit_qty: stock?.total_in_transit_qty ?? 0,
          total_unreceived_qty: stock?.total_unreceived_qty ?? 0,
          total_open_vial_qty: stock?.total_open_vial_qty ?? 0,
          total_available_qty: stock?.total_available_qty ?? 0,
          updated_at: stock?.updated_at ?? null,
          min: item.min,
          max: item.max,
        }

        return {
          ...aggregate,
          aggregate,
          entity: entityDetail,
          material: {
            id: item.material_id,
            name: item.material_name,
            material_level_id: item.material_level_id,
            is_temperature_sensitive: item.is_temperature_sensitive,
            is_open_vial: item.is_open_vial,
            is_managed_in_batch: item.is_managed_in_batch,
            unit_of_consumption: item.unit_of_consumption,
            consumption_unit_per_distribution_unit:
              item.consumption_unit_per_distribution_unit,
            status: item.material_status,
          },
          details:
            with_details === 1
              ? await this.#details(c, {
                  entity_id: item.entity_id,
                  material_id: item.material_id,
                  group_by: "activity",
                })
              : [],
        }
      })
    )

    return new PaginatedResponse(params, response, total)
  }
}
