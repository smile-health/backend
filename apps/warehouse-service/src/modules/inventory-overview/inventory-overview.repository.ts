import { Context } from "hono"
import { execQuery } from "@/common/infrastructure/database/index.js"
import {
  InventoryOverviewQueryParams,
  InventoryDataDTO,
  LastUpdatedDTO,
  TemperatureOverviewQueryParams,
  TemperatureOverviewAggregatedDTO,
  TemperatureLocationAggregatedDTO,
  StockMaterialQueryParams,
  MaterialEntityQueryParams,
} from "./inventory-overview.schema.js"
import { InventoryOverviewQuery } from "./inventory-overview.query.js"

export class InventoryOverviewRepository {
  constructor(
    private readonly inventoryOverviewQuery: InventoryOverviewQuery
  ) {}

  async fetchInventoryData(
    c: Context,
    queryParams: InventoryOverviewQueryParams
  ): Promise<InventoryDataDTO[]> {
    const query = this.inventoryOverviewQuery.buildInventoryQuery(
      c,
      queryParams
    )

    const result = await execQuery<InventoryDataDTO[]>(query, {
      ...queryParams,
    })

    return result
  }

  async fetchLastUpdated(): Promise<LastUpdatedDTO | null> {
    const query = this.inventoryOverviewQuery.buildLastUpdatedQuery()
    const result = await execQuery<LastUpdatedDTO[]>(query)
    return result[0] || null
  }

  async fetchActiveEntityIds(
    c: Context,
    queryParams: InventoryOverviewQueryParams
  ): Promise<number[]> {
    const query = this.inventoryOverviewQuery.buildActiveEntitiesQuery(
      c,
      queryParams
    )

    const result = await execQuery<{ entityId: number }[]>(query, {
      ...queryParams,
    })

    return result.map((r) => r.entityId)
  }

  async fetchLastActivityUpdate(): Promise<LastUpdatedDTO | null> {
    const query = this.inventoryOverviewQuery.buildLastActivityUpdateQuery()
    const result = await execQuery<LastUpdatedDTO[]>(query)
    return result[0] || null
  }

  async fetchTemperatureData(
    c: Context,
    queryParams: TemperatureOverviewQueryParams
  ): Promise<TemperatureOverviewAggregatedDTO[]> {
    const query = this.inventoryOverviewQuery.buildTemperatureOverviewQuery(
      c,
      queryParams
    )

    const result = await execQuery<TemperatureOverviewAggregatedDTO[]>(query, {
      ...queryParams,
    })

    return result
  }

  async fetchTemperatureLocationData(
    c: Context,
    queryParams: TemperatureOverviewQueryParams
  ): Promise<TemperatureLocationAggregatedDTO[]> {
    const query = this.inventoryOverviewQuery.buildTemperatureLocationQuery(
      c,
      queryParams
    )

    const result = await execQuery<TemperatureLocationAggregatedDTO[]>(query, {
      ...queryParams,
    })

    return result
  }

  async fetchLastTemperatureUpdate(): Promise<LastUpdatedDTO | null> {
    const query = this.inventoryOverviewQuery.buildLastTemperatureUpdateQuery()
    const result = await execQuery<LastUpdatedDTO[]>(query)
    return result[0] || null
  }

  async fetchTemperatureDenominator(
    c: Context,
    queryParams: TemperatureOverviewQueryParams
  ): Promise<{ total_inventory_count: number }> {
    const query =
      this.inventoryOverviewQuery.buildTemperatureDenominatorOverviewQuery(
        c,
        queryParams
      )

    const result = await execQuery<{ total_inventory_count: number }[]>(query, {
      ...queryParams,
    })

    return result[0] || { total_inventory_count: 0 }
  }

  async fetchTemperatureDenominatorByLocation(
    c: Context,
    queryParams: TemperatureOverviewQueryParams
  ): Promise<{ location_id: number; total_inventory_count: number }[]> {
    const query =
      this.inventoryOverviewQuery.buildTemperatureDenominatorLocationQuery(
        c,
        queryParams
      )

    const result = await execQuery<
      { location_id: number; total_inventory_count: number }[]
    >(query, {
      ...queryParams,
    })

    return result
  }
}
