import { Context } from "hono"
import { ActivityDTO, ActivityQueryParams } from "./activity.schema.js"
import { execQuery } from "@/common/infrastructure/database/index.js"
import { ActivityQuery } from "./activity.query.js"
import {
  CountDTO,
  PaginationOption,
} from "@/common/schemas/pagination.schema.js"

export class ActivityRepository {
  constructor(private readonly activityQuery: ActivityQuery) {}

  async fetchActivities(
    c: Context,
    queryParams: ActivityQueryParams,
    { is_paginate = true }: PaginationOption = {}
  ): Promise<{ records: ActivityDTO; count: number }> {
    const query = this.activityQuery.buildActivityQuery(c, queryParams, {
      is_paginate,
      count: false,
    })
    const countQuery = this.activityQuery.buildActivityQuery(c, queryParams, {
      is_paginate: false,
      count: true,
    })

    const records = await execQuery<ActivityDTO>(query, queryParams)
    const count = await execQuery<CountDTO>(countQuery, queryParams)

    return { records, count: count[0]!.count ?? 0 }
  }
}
