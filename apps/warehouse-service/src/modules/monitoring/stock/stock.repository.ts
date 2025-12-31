import { execQuery } from "@/common/infrastructure/database/index.js"
import {
  DASHBOARD_STOCK_INFORMATION_TYPE,
  DASHBOARD_STOCK_TYPE,
} from "@/common/constants/monitoring.js"
import { MonitoringStockInTransitQuery } from "./stock.intransit.query.js"
import { MonitoringStockOnHandQuery } from "./stock.onhand.query.js"
import {
  MonitoringStockDTO,
  MonitoringStockSchemaQueryParams,
} from "./stock.schema.js"
import { conditionQuery, valueConditionQuery } from "./stock.utils.js"
import { Context } from "hono"

export class MonitoringStockRepository {
  constructor(
    private readonly monitoringStockOnHandQuery: MonitoringStockOnHandQuery,
    private readonly monitoringStockInTransitQuery: MonitoringStockInTransitQuery
  ) {}

  async getMonitoringStock(
    c: Context,
    queryParams: MonitoringStockSchemaQueryParams
  ): Promise<MonitoringStockDTO[]> {
    const conditionQueryValue = conditionQuery(queryParams)
    const valueConditionQueryValue = valueConditionQuery(c, queryParams)

    const mapQuery = this.mapQuery(c, queryParams, conditionQueryValue)
    const buildQuery = mapQuery[queryParams.monitoringStockType ?? 0]
    if (!buildQuery)
      throw new Error(
        `Unsupported monitoringStockType param: ${queryParams.monitoringStockType}`
      )

    const result = await execQuery(buildQuery, valueConditionQueryValue)
    return result as MonitoringStockDTO[]
  }

  async getFurtherBatchExpiredDate() {
    const query = `
    SELECT rwb.expired_date FROM raw_ws_batches rwb FINAL
    WHERE rwb.deleted_at is null
    ORDER BY rwb.expired_date DESC
    LIMIT 1
    `

    const result = await execQuery(query)
    return result[0] as { expired_date: string }
  }

  private mapQuery(
    c: Context,
    queryParams: MonitoringStockSchemaQueryParams,
    conditionQueryValue: string
  ) {
    const isOnHand =
      queryParams.information_type ===
      DASHBOARD_STOCK_INFORMATION_TYPE.STOCK_ON_HAND

    const handler = isOnHand
      ? this.monitoringStockOnHandQuery
      : this.monitoringStockInTransitQuery

    const methodMap: Record<
      (typeof DASHBOARD_STOCK_TYPE)[keyof typeof DASHBOARD_STOCK_TYPE],
      (queryParams: MonitoringStockSchemaQueryParams, cond: string) => string
    > = {
      [DASHBOARD_STOCK_TYPE.CHART]: (queryParams, cond) =>
        handler.queryChart(c, queryParams, cond),
      [DASHBOARD_STOCK_TYPE.ENTITY]: (queryParams, cond) =>
        handler.queryEntity(c, queryParams, cond),
      [DASHBOARD_STOCK_TYPE.ENTITY_MATERIAL]: (queryParams, cond) =>
        handler.queryEntityMaterial(c, queryParams, cond),
      [DASHBOARD_STOCK_TYPE.ENTITY_STOCK]: (queryParams, cond) =>
        handler.queryEntityStock(c, queryParams, cond),
      [DASHBOARD_STOCK_TYPE.PROVINCE]: (queryParams, cond) =>
        handler.queryProvince(c, queryParams, cond),
      [DASHBOARD_STOCK_TYPE.REGENCY]: (queryParams, cond) =>
        handler.queryRegency(c, queryParams, cond),
    }

    return Object.fromEntries(
      Object.entries(methodMap).map(([key, fn]) => [
        key,
        fn(queryParams, conditionQueryValue),
      ])
    )
  }
}
