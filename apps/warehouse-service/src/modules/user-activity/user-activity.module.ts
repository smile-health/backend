import { PaginatedResponse } from "@smile/lib/types/paginate.js"
import { Context } from "hono"
import moment from "moment"
import { UserActivityRepository } from "./user-activity.repository.js"
import {
  ActivityByEntityDTO,
  UserActivityDTO,
  UserActivityQueryParams,
} from "./user-activity.schema.js"
import ExportHistoryRepository from "../export-history/export-history.repository.js"
import { BaseModule } from "../base.module.js"
import { UserActivityTemplateExcel } from "./user-activity.excel.js"
import { MaterialRepository } from "../material/material.repository.js"
import { KFA_LEVEL_CODE } from "@/common/constants/material.js"
import { Publisher } from "@smile/lib/rabbitmq/publisher.js"
import { TOPIC } from "@smile/lib/rabbitmq/topic.js"

export class UserActivityModule extends BaseModule {
  constructor(
    private readonly userActivityRepo: UserActivityRepository,
    private readonly materialRepo: MaterialRepository,
    protected readonly exportHistoryRepo: ExportHistoryRepository,
    protected readonly publisher: Publisher
  ) {
    super(exportHistoryRepo, publisher)
  }

  async getActivityCount(c: Context, queryParams: UserActivityQueryParams) {
    const activityAll = await this.userActivityRepo.getActivityAll(queryParams)
    const activityUserOverview =
      await this.userActivityRepo.getActivityOverview(queryParams)

    return this.mapResponseActivityCount(
      c,
      activityAll,
      activityUserOverview,
      queryParams
    )
  }

  async getActivityByEntity(
    c: Context,
    queryParams: UserActivityQueryParams,
    isDownload: boolean = false
  ) {
    const intervalPeriod = this.getIntervalPeriod(
      moment(queryParams.from, "YYYY-MM-DD").year(),
      moment(queryParams.from, "YYYY-MM-DD").month()
    )
    queryParams.offset = (queryParams.page - 1) * queryParams.paginate

    const activityAll = await this.userActivityRepo.getActivityAll(queryParams)
    const activityDates =
      await this.userActivityRepo.getActivityDates(queryParams)

    const { records: entities, count: total } =
      await this.userActivityRepo.fetchUserActivityEntities(c, queryParams, {
        is_paginate: !isDownload,
      })

    const listEntities = this.mapResponseActivityByEntity(
      c,
      entities,
      intervalPeriod,
      activityAll,
      queryParams.activity_ids
    )

    activityDates.forEach((actDat) => {
      const listIndex = listEntities.findIndex(
        (el) => Number(el.id) == actDat.entity_id
      )

      if (listEntities[listIndex]) {
        const listObj = Object.keys(listEntities[listIndex].overview)

        if (listObj.includes(actDat.date!))
          listEntities[listIndex].overview[actDat.date!] =
            actDat.active_transaction

        const reduceList = listObj.filter(
          (el) => listEntities[listIndex]?.overview[el]
        )

        listEntities[listIndex].total_active_days = Number(
          reduceList.length.toFixed(2) ?? 0
        )
        listEntities[listIndex].total_inactive_days = Number(
          Number(listObj.length - reduceList.length).toFixed(2)
        )
        listEntities[listIndex].total_frequency = Number(
          reduceList
            .reduce(
              (acc, currVal) =>
                acc + listEntities[listIndex]?.overview[currVal],
              0
            )
            .toFixed(2)
        )
        listEntities[listIndex].average_frequency = Number(
          Number(
            listEntities[listIndex].total_frequency /
              listEntities[listIndex].total_active_days
          ).toFixed(2)
        )
      }
    })

    const responseEntities = listEntities.map((el) => {
      return {
        ...el,
        customer_id: queryParams.is_customer_activity
          ? el.customer_id
          : undefined,
        customer_name: queryParams.is_customer_activity
          ? el.customer_name
          : undefined,
        province_name: isDownload ? el.province_name : undefined,
        regency_name: isDownload ? el.regency_name : undefined,
        overview: isDownload ? el.overview : [{ ...el.overview }],
      }
    }) as ActivityByEntityDTO[]

    if (isDownload) {
      return {
        intervalPeriod,
        data: responseEntities,
      }
    }

    return {
      month: moment(queryParams.from).format("MMM YYYY").toString(),
      interval_period: intervalPeriod,
      ...new PaginatedResponse(
        { page: queryParams.page, paginate: queryParams.paginate },
        responseEntities,
        total
      ),
    }
  }

  async getActivityByEntityExport(
    c: Context,
    queryParams: UserActivityQueryParams
  ) {
    const { intervalPeriod, data } = await this.getActivityByEntity(
      c,
      queryParams,
      true
    )

    const materialResult = await this.materialRepo.fetchMaterials(
      c,
      { ...queryParams, material_level_id: KFA_LEVEL_CODE.VARIANT },
      {
        is_paginate: false,
      }
    )
    const materials = materialResult.records

    const title = c.var.t("user-activity.export.label")
    const activityByEntityExcel = new UserActivityTemplateExcel(1)

    return await activityByEntityExcel.generateUserActivityEntity(
      c,
      title,
      data,
      materials,
      queryParams,
      intervalPeriod
    )
  }

  async export(c: Context, params: UserActivityQueryParams) {
    params.program_id = c.var.programId

    return await this.handleAsyncExport(c, TOPIC.REPORT_USER_ACTIVITY_EXPORTED, {
      filename: c.var.t("user-activity.export.label"),
      params,
    })
  }

  getIntervalPeriod(year: number, month: number) {
    const dated = new Date(Number(year), Number(month), 1)
    const days: string[] = []
    while (dated.getMonth() === Number(month)) {
      days.push(moment(new Date(dated)).format("YYYY-MM-DD"))
      dated.setDate(dated.getDate() + 1)
    }

    return days
  }

  private mapResponseActivityCount(
    c: Context,
    activityAll: UserActivityDTO[],
    activityUserOverview: UserActivityDTO | undefined,
    queryParams: UserActivityQueryParams
  ) {
    return {
      month: moment(queryParams.from).format("MMM YYYY").toString(),
      activity_id: queryParams.activity_ids
        ? activityAll
            .map((el) => el.activity_id)
            ?.filter((val, indx, self) => self.indexOf(val) === indx)
            ?.join(", ")
        : c.var.t("common.all"),
      activity_name: queryParams.activity_ids
        ? activityAll
            .map((el) => el.activity_name)
            ?.filter((val, indx, self) => self.indexOf(val) === indx)
            ?.join(", ")
        : c.var.t("common.all"),
      overview: {
        label: moment(queryParams.from).format("YYYY-MM").toString(),
        active: {
          value: Number(
            activityUserOverview!.pct_active_entity?.toFixed(2) ?? 0
          ),
          entity: Number(activityUserOverview?.active_entity ?? 0),
          toolText: `${c.var.t("common.active")}: ${Number(activityUserOverview?.pct_active_entity ?? 0).toFixed(2)}% (${Number(activityUserOverview?.active_entity ?? 0)} of ${activityUserOverview?.total_entity ?? 0} ${c.var.t("common.entity")})`,
        },
        inactive: {
          value: Number(
            activityUserOverview?.pct_non_active_entity?.toFixed(2) ?? 0
          ),
          entity: Number(activityUserOverview?.non_active_entity ?? 0),
          toolText: `${c.var.t("common.inactive")}: ${Number(activityUserOverview?.pct_non_active_entity ?? 0).toFixed(2)}% (${Number(activityUserOverview?.non_active_entity ?? 0)} of ${activityUserOverview?.total_entity ?? 0} ${c.var.t("common.entity")})`,
        },
      },
      // last_updated: // column updated_at not yet in datamart_transactions
    }
  }

  private mapResponseActivityByEntity(
    c: Context,
    entities: UserActivityDTO[],
    intervalPeriod: string[],
    activityAll: UserActivityDTO[],
    activityIds: number[] | undefined
  ) {
    return entities.map((ent) => {
      const overview = {}
      intervalPeriod.forEach((date) => {
        overview[date] = 0
      })
      return {
        id: ent.entity_id,
        name: ent.entity_name,
        customer_id: ent.customer_id,
        customer_name: ent.customer_name,
        province_name: ent.province_name,
        regency_name: ent.regency_name,
        activity_id: activityIds
          ? activityAll
            .map((el) => el.activity_id)
            ?.filter((val, indx, self) => self.indexOf(val) === indx)
            ?.join(", ")
          : c.var.t("common.all"),
        activity_name: activityIds
          ? activityAll
            .map((el) => el.activity_name)
            ?.filter((val, indx, self) => self.indexOf(val) === indx)
            ?.join(", ")
          : c.var.t("common.all"),
        total_active_days: 0,
        total_inactive_days: intervalPeriod.length,
        total_frequency: 0,
        average_frequency: 0,
        overview: { ...overview },
      }
    })
  }
}
