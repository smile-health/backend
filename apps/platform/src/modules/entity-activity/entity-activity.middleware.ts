import moment from "moment"
import { createMiddleware } from "hono/factory"
import { ValidationError } from "@smile/lib/error.js"
import { EntityActivityRepository } from "./entity-activity.repository.js"

export class EntityActivityMiddleware {
  constructor(private entityActivityRepo: EntityActivityRepository) {}
  validateActivity = createMiddleware(async (c, next) => {
    const { activities } = await c.req.json()
    const listIdActivity = await this.entityActivityRepo.getListActivity(c)
    for (const item of activities) {
      const isExist = listIdActivity.some((data) => {
        return data.id === item.activity_id
      })

      if (!isExist) {
        throw new ValidationError("Activity ID not found")
      }

      const joinDate = item.join_date
      const endDate = item.end_date
      if (
        (joinDate && endDate && moment(joinDate).isAfter(moment(endDate))) ||
        (!joinDate && endDate)
      ) {
        throw new ValidationError("Invalid Date Range")
      }
    }

    await next()
  })
}
