import moment from "moment"
import { LplpoRepository } from "./lplpo.repository.js"
import { Context } from "hono"

import { BaseModule } from "../base.module.js"
import ExportHistoryRepository from "../export-history/export-history.repository.js"
import { Publisher } from "@smile-health/lib/rabbitmq/publisher.js"
import { TOPIC } from "@smile-health/lib/rabbitmq/topic.js"
import { LplpoQueryParamsExportSchema } from "./lplpo.schema.js"
import { z } from "zod"

type LplpoQueryParams = z.infer<typeof LplpoQueryParamsExportSchema>

export class LplpoModule extends BaseModule {
  constructor(
    private lplpoRepository: LplpoRepository,
    // private readonly materialRepository: MaterialRepository,
    // private readonly entityRepository: EntityRepository,
    protected readonly exportHistoryRepo: ExportHistoryRepository,
    protected readonly publisher: Publisher
  ) {
    super(exportHistoryRepo, publisher)
  }

  async getLplpoRepository(
    c: Context,
    page: number,
    limit: number,
    query: any
  ) {
    return this.lplpoRepository.getLplpoDataExport(c, {
      entityId: query.entity_id,
      activityId: query.activity_id,
      provinceId: query.province_id,
      regencyId: query.regency_id,
      subDistrictId: query.sub_district_id,
      period: query.period,
      month: moment(query.start_date).month() + 1,
      year: moment(query.end_date).year(),
      search: query.search,
      programId: c.var?.programId,
    })
    // return this.lplpoRepository.getLplpoData(c, page, limit, {
    //   entityId: query.entity_id,
    //   activityId: query.activity_id,
    //   provinceId: query.province_id,
    //   regencyId: query.regency_id,
    //   subDistrictId: query.sub_district_id,
    //   period: query.period,
    //   month: moment(query.start_date).month() + 1,
    //   year: moment(query.end_date).year(),
    //   search: query.search,
    //   programId: c.var?.programId,
    // })
  }

  async exportDataLplpo(c: Context, queryParams: any) {
    return this.lplpoRepository.getLplpoDataExport(c, {
      entityId: queryParams.entity_id,
      activityId: queryParams.activity_id,
      provinceId: queryParams.province_id,
      regencyId: queryParams.regency_id,
      subDistrictId: queryParams.sub_district_id,
      period: queryParams.period,
      month: moment(queryParams.start_date).month() + 1,
      year: moment(queryParams.end_date).year(),
      search: queryParams.search,
      programId: queryParams?.programId,
    })
  }

  async exportReport(c: Context, queryParams: any) {
    const monthYear = queryParams.start_date
      ? moment(queryParams.start_date).format("MMMM_YYYY")
      : "Export"

    const exportHistoryId = await this.handleAsyncExport(
      c,
      TOPIC.LPLPO_EXPORTED,
      {
        filename: `LPLPO_${monthYear}`,
        params: queryParams,
        ext: "xlsx", // Single Excel file, not ZIP
      }
    )

    return {
      export_history_id: exportHistoryId,
      message: "Export process started. You will be notified when it's done.",
    }
  }

  async exportAllReport(c: Context, queryParams: any) {
    const monthYear = queryParams.start_date
      ? moment(queryParams.start_date).format("MMMM_YYYY")
      : "Export"

    const exportHistoryId = await this.handleAsyncExport(
      c,
      TOPIC.LPLPO_ALL_EXPORTED,
      {
        filename: `LPLPO_All_${monthYear}`,
        params: queryParams,
      }
    )

    return {
      export_history_id: exportHistoryId,
      message: "Export process started. You will be notified when it's done.",
    }
  }

  async getParentMaterialByEntity(
    c: Context,
    entityId?: string,
    type?: "parent" | "child",
    region?: {
      provinceId?: string
      regencyId?: string
      programId?: string
    }
  ) {
    return this.lplpoRepository.getMaterialByEntityId(c, entityId, type, {
      ...region,
      programId: region?.programId || String(c.var?.programId),
    })
  }
}
