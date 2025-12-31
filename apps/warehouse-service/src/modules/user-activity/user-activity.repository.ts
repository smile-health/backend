import { execQuery } from "@/common/infrastructure/database/index.js"
import { UserActivityQuery } from "./user-activity.query.js"
import {
  USER_ACTIVITY_TYPE,
  UserActivityDTO,
  UserActivityQueryParams,
} from "./user-activity.schema.js"
import { conditionQuery, valueConditionQuery } from "./user-activity.utils.js"
import { Context } from "hono"
import {
  CountDTO,
  PaginationOption,
} from "@/common/schemas/pagination.schema.js"

export class UserActivityRepository {
  constructor(private readonly userActivityQuery: UserActivityQuery) {}

  async getUserActivity(
    queryParams: UserActivityQueryParams,
    isUser: boolean = false
  ) {
    const conditionQueryValue = conditionQuery(queryParams, isUser)
    const valueConditionQueryValue = valueConditionQuery(queryParams)

    const mapQuery = this.mapQuery(queryParams, conditionQueryValue)
    const buildQuery = mapQuery[queryParams.userActivityType ?? 0]
    if (!buildQuery)
      throw new Error(
        `Unsupported userActivityType param: ${queryParams.userActivityType}`
      )

    const result = await execQuery(buildQuery, valueConditionQueryValue)
    return result as UserActivityDTO[]
  }

  async getActivityAll(queryParams: UserActivityQueryParams) {
    queryParams.userActivityType = USER_ACTIVITY_TYPE.ALL
    const activityAll = await this.getUserActivity(queryParams)
    return activityAll
  }

  async getActivityDates(queryParams: UserActivityQueryParams) {
    queryParams.userActivityType = USER_ACTIVITY_TYPE.DATES
    const activityUser = await this.getUserActivity(queryParams, true)
    return activityUser
  }

  async getActivityOverview(queryParams: UserActivityQueryParams) {
    queryParams.userActivityType = USER_ACTIVITY_TYPE.OVERVIEW
    const activityUserOverview = await this.getUserActivity(queryParams)
    return activityUserOverview[0]
  }

  async getCalculateEntityForActivity(queryParams: UserActivityQueryParams) {
    queryParams.userActivityType = USER_ACTIVITY_TYPE.CALCULATE_ENTITY
    const calculateEntityForActivity = await this.getUserActivity(queryParams)
    return calculateEntityForActivity
  }

  async fetchUserActivityEntities(
    c: Context,
    queryParams: UserActivityQueryParams,
    { is_paginate = true }: PaginationOption = {}
  ): Promise<{ records: UserActivityDTO[]; count: number }> {
    const queryPaginationOption = {
      is_paginate,
      count: false,
    }
    const queryCountPaginationOption = {
      is_paginate: false,
      count: true,
    }
    const query = queryParams.is_customer_activity
      ? this.userActivityQuery.buildCustomerQuery(
          c,
          queryParams,
          queryPaginationOption
        )
      : this.userActivityQuery.buildEntityQuery(
          c,
          queryParams,
          queryPaginationOption
        )
    const countQuery = queryParams.is_customer_activity
      ? this.userActivityQuery.buildCustomerQuery(
          c,
          queryParams,
          queryCountPaginationOption
        )
      : this.userActivityQuery.buildEntityQuery(
          c,
          queryParams,
          queryCountPaginationOption
        )

    const records = await execQuery<UserActivityDTO[]>(query, queryParams)
    const count = await execQuery<CountDTO>(countQuery, queryParams)

    return { records, count: count[0]!.count ?? 0 }
  }

  private mapQuery(
    queryParams: UserActivityQueryParams,
    conditionQueryValue: string
  ) {
    const handler = this.userActivityQuery

    const methodMap: Record<
      (typeof USER_ACTIVITY_TYPE)[keyof typeof USER_ACTIVITY_TYPE],
      (queryParams: UserActivityQueryParams, cond: string) => string
    > = {
      [USER_ACTIVITY_TYPE.DATES]: (_, cond) => handler.queryActivityDates(cond),
      [USER_ACTIVITY_TYPE.OVERVIEW]: (queryParams, cond) =>
        handler.queryOverview(queryParams, cond),
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      [USER_ACTIVITY_TYPE.ALL]: (queryParams, _) =>
        handler.queryActivityAll(queryParams.activity_ids),
      [USER_ACTIVITY_TYPE.CALCULATE_ENTITY]: (_, cond) =>
        handler.queryCalculateEntityForActivity(cond),
    }

    return Object.fromEntries(
      Object.entries(methodMap).map(([key, fn]) => [
        key,
        fn(queryParams, conditionQueryValue),
      ])
    )
  }
}
