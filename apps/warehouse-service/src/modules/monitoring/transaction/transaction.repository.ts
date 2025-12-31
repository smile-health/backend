import { DASHBOARD_TRANSACTION_TYPE } from "@/common/constants/monitoring.js"
import { execQuery } from "@/common/infrastructure/database/index.js"
import { Context } from "hono"
import { MonitoringTransactionQuery } from "./transaction.query.js"
import {
  MonitoringTransactionDTO,
  MonitoringTransactionSchemaQueryParams,
} from "./transaction.schema.js"
import { conditionQuery, valueConditionQuery } from "./transaction.utils.js"

export class MonitoringTransactionRepository {
  constructor(
    private readonly monitoringTransactionQuery: MonitoringTransactionQuery
  ) {}

  async getMonitoringTransaction(
    c: Context,
    queryParams: MonitoringTransactionSchemaQueryParams,
    withPagination: boolean = true
  ) {
    const conditionQueryValue = conditionQuery(queryParams)
    const valueConditionQueryValue = valueConditionQuery(c, queryParams)

    const mapQuery = this.mapQuery(
      c,
      queryParams,
      conditionQueryValue,
      withPagination
    )
    const buildQuery = mapQuery[queryParams.monitoringTransactionType ?? 0]

    if (!buildQuery)
      throw new Error(
        `Unsupported monitoringTreansactionType param: ${queryParams.monitoringTransactionType}`
      )

    const result = await execQuery(buildQuery, valueConditionQueryValue)
    return result as MonitoringTransactionDTO[]
  }

  async getMonitoringTransactionCount(
    c: Context,
    queryParams: MonitoringTransactionSchemaQueryParams
  ): Promise<number> {
    const conditionQueryValue = conditionQuery(queryParams)
    const valueConditionQueryValue = valueConditionQuery(c, queryParams)

    let countQuery: string
    if (
      queryParams.monitoringTransactionType ===
      DASHBOARD_TRANSACTION_TYPE.ENTITY
    ) {
      countQuery = this.monitoringTransactionQuery.queryEntity(
        c,
        queryParams,
        conditionQueryValue,
        false, // withPagination
        true // isCount
      )
    } else if (
      queryParams.monitoringTransactionType ===
      DASHBOARD_TRANSACTION_TYPE.ENTITY_COMPLETE
    ) {
      countQuery = this.monitoringTransactionQuery.queryEntityComplete(
        c,
        queryParams,
        conditionQueryValue,
        false, // withPagination
        true // isCount
      )
    } else {
      throw new Error(
        `Count query not supported for monitoringTransactionType: ${queryParams.monitoringTransactionType}`
      )
    }

    const result = (await execQuery(countQuery, valueConditionQueryValue)) as {
      total: number
    }[]
    return result[0]?.total ?? 0
  }

  async getParentMaterialId(programId: number, materialIds: number[]) {
    const query = `
    select rwm.id as id from raw_ws_materials rwm FINAL where rwm.program_id = {program_id:Int} and rwm.deleted_at is null and rwm.parent_id in {material_ids:Array(Int64)}
    `
    const result: { id: number }[] = await execQuery(query, {
      program_id: programId,
      material_ids: materialIds,
    })
    return result.map((item) => item.id)
  }

  private mapQuery(
    c: Context,
    queryParams: MonitoringTransactionSchemaQueryParams,
    conditionQueryValue: string,
    withPagination: boolean = true
  ) {
    const methodMap: Record<
      (typeof DASHBOARD_TRANSACTION_TYPE)[keyof typeof DASHBOARD_TRANSACTION_TYPE],
      (
        queryParams: MonitoringTransactionSchemaQueryParams,
        cond: string
      ) => string
    > = {
      [DASHBOARD_TRANSACTION_TYPE.CHART]: (
        queryParams: MonitoringTransactionSchemaQueryParams,
        cond: string
      ) => this.monitoringTransactionQuery.queryChart(c, queryParams, cond),
      [DASHBOARD_TRANSACTION_TYPE.CHART_OLD]: (
        queryParams: MonitoringTransactionSchemaQueryParams,
        cond: string
      ) => this.monitoringTransactionQuery.queryChartOld(c, queryParams, cond),
      [DASHBOARD_TRANSACTION_TYPE.PROVINCE]: (
        queryParams: MonitoringTransactionSchemaQueryParams,
        cond: string
      ) => this.monitoringTransactionQuery.queryProvince(c, queryParams, cond),
      [DASHBOARD_TRANSACTION_TYPE.REGENCY]: (
        queryParams: MonitoringTransactionSchemaQueryParams,
        cond: string
      ) => this.monitoringTransactionQuery.queryRegency(c, queryParams, cond),
      [DASHBOARD_TRANSACTION_TYPE.ENTITY]: (
        queryParams: MonitoringTransactionSchemaQueryParams,
        cond: string
      ) =>
        this.monitoringTransactionQuery.queryEntity(
          c,
          queryParams,
          cond,
          withPagination,
          false // isCount
        ),
      [DASHBOARD_TRANSACTION_TYPE.ENTITY_COMPLETE]: (
        queryParams: MonitoringTransactionSchemaQueryParams,
        cond: string
      ) =>
        this.monitoringTransactionQuery.queryEntityComplete(
          c,
          queryParams,
          cond,
          withPagination,
          false // isCount
        ),
      [DASHBOARD_TRANSACTION_TYPE.MATERIAL]: (
        queryParams: MonitoringTransactionSchemaQueryParams,
        cond: string
      ) => this.monitoringTransactionQuery.queryMaterial(c, queryParams, cond),
      [DASHBOARD_TRANSACTION_TYPE.TRANSACTION_REASON]: (_, cond: string) =>
        this.monitoringTransactionQuery.queryTransactionReason(cond),
    }

    return Object.fromEntries(
      Object.entries(methodMap).map(([key, fn]) => [
        key,
        fn(queryParams, conditionQueryValue),
      ])
    )
  }
}
