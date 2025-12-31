import { QueryParamDateRangeValidator } from "@/common/validators/query-param-date-range.validator.js"
import { KFA_LEVEL_CODE } from "@/common/constants/material.js"
import { Context } from "hono"
import { z } from "zod"
import {
  MonitoringStockSchemaQueryParams,
  MonitoringStockSchemaQueryParamsShchema,
} from "./stock.schema.js"
import { ActivityRepository } from "@/modules/activity/activity.repository.js"
import { collect } from "@smile/lib/utils.js"

export class MonitoringStockMiddleware {
  constructor(
    private readonly queryParamDateRangeValidator: QueryParamDateRangeValidator,
    private readonly activityRepo: ActivityRepository
  ) {}

  common = (c: Context) => {
    return MonitoringStockSchemaQueryParamsShchema.superRefine(
      async (
        queryParams: MonitoringStockSchemaQueryParams,
        ctx: z.RefinementCtx
      ) => {
        this.queryParamDateRangeValidator.checkToGreaterThanFrom(
          c,
          ctx,
          queryParams
        )
        this.queryParamDateRangeValidator.checkExpiredDateDependencies(
          c,
          ctx,
          queryParams
        )

        const activitiesResult = !queryParams.activity_ids
          ? await this.activityRepo.fetchActivities(c, queryParams, {
              is_paginate: false,
            })
          : { records: [] }
        const backupFilterActivities = activitiesResult.records

        queryParams.activity_ids =
          Array.isArray(backupFilterActivities) &&
          backupFilterActivities.length > 0
            ? collect(backupFilterActivities, "id")
            : queryParams.activity_ids

        queryParams.kfaMaterial = {
          columnId:
            queryParams.material_level_id === KFA_LEVEL_CODE.TEMPLATE
              ? "s.dmm_parent_id as master_materials_id"
              : "transactions_master_material_id as master_materials_id",
          columnName:
            queryParams.material_level_id === KFA_LEVEL_CODE.TEMPLATE
              ? "rwm.name as master_materials_name"
              : "dmm_name as master_materials_name",
          joinTable:
            queryParams.material_level_id === KFA_LEVEL_CODE.TEMPLATE
              ? "JOIN raw_ws_materials as rwm FINAL ON rwm.id = s.dmm_parent_id"
              : "",
          orderBy: "qty DESC",
        }
      }
    )
  }
}
