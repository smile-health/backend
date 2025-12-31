import { Context } from "hono"
import {
  ReconciliationQueryParams,
  ReconciliationBarReportResponse,
  ReconciliationEntityReportResponse,
} from "./reconciliation.schema.js"
import { ReconciliationRepository } from "./reconciliation.repository.js"
import { formatBarData, formatListEntityRecon } from "./reconciliation.utils.js"
import moment from "moment"
import { EntityRepository } from "../entity/entity.repository.js"
import { EntityQueryParams } from "../entity/entity.schema.js"
import { ActivityRepository } from "../activity/activity.repository.js"
import { RegionRepository } from "../region/region.repository.js"
import { EntityTagRepository } from "../entity-tag/entity-tag.repository.js"
import { ReconciliationExcel } from "./reconciliation.excel.js"

export class ReconciliationModule {
  constructor(
    private readonly reconciliationRepository: ReconciliationRepository,
    private readonly entityRepository: EntityRepository,
    private readonly entityTagRepository: EntityTagRepository,
    private readonly regionRepository: RegionRepository,
    private readonly activityRepository: ActivityRepository,
    private readonly reconciliationExcel: ReconciliationExcel
  ) {}

  async barChartReport(
    c: Context,
    queryParams: ReconciliationQueryParams
  ): Promise<ReconciliationBarReportResponse> {
    const { start_date, end_date } = queryParams
    const year = parseInt(moment(start_date).format("YYYY"))

    const months: number[] = []
    const startMonth = parseInt(moment(start_date).format("M"))
    const endMonth = parseInt(moment(end_date).format("M"))
    for (let i = startMonth; i <= endMonth; i++) {
      months.push(i)
    }

    const reconByMonth =
      await this.reconciliationRepository.fetchReconciliationBarReport(
        c,
        queryParams
      )

    return formatBarData({ reconByMonth, year, months })
  }

  async entityTableReport(
    c: Context,
    queryParams: ReconciliationQueryParams,
    download: boolean = false
  ): Promise<ReconciliationEntityReportResponse> {
    const { start_date, end_date, page, paginate } = queryParams

    const months: number[] = []
    const startMonth = parseInt(moment(start_date).format("M"))
    const endMonth = parseInt(moment(end_date).format("M"))
    for (let i = startMonth; i <= endMonth; i++) {
      months.push(i)
    }

    const entityQueryParams: EntityQueryParams = {
      ...queryParams,
      from: start_date,
      to: end_date,
      exlcude_entity_type_center: true,
    }

    const { records: entities, count: total } =
      await this.entityRepository.fetchEntities(c, entityQueryParams, {
        is_paginate: !download,
      })

    const reconciliations =
      await this.reconciliationRepository.fetchReconciliationEntityReport(
        c,
        queryParams
      )

    const { list } = formatListEntityRecon({
      entities,
      reconciliations,
      months,
    })

    return {
      page: page!,
      item_per_page: paginate!,
      total_item: total,
      total_page: Math.ceil(total / paginate!),
      list_pagination: [10, 25, 50, 100],
      data: list,
    }
  }

  async entityTableReportExport(
    c: Context,
    queryParams: ReconciliationQueryParams
  ) {
    const entityTableReport = await this.entityTableReport(c, queryParams, true)
    return await this.reconciliationExcel.generateEntityTableReportExport(
      c,
      queryParams,
      entityTableReport
    )
  }

}
