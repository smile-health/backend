import { ValidationError } from "@smile/lib/error.js"
import { collect } from "@smile/lib/utils.js"
import { Context } from "hono"
import { createMiddleware } from "hono/factory"
import moment from "moment"
import { EntityActivityRepository } from "./entity-activity.repository.js"

export class EntityActivityMiddleware {
  constructor(private readonly entityActivityRepo: EntityActivityRepository) {}
  validateActivity = createMiddleware(async (c, next) => {
    const { activities } = await c.req.json()
    const activityIDs = collect(activities, "activity_id")
    const listIdActivity = await this.entityActivityRepo.getListActivity(
      c,
      c.get("programId"),
      activityIDs
    )
    for (const item of activities) {
      const isExist = listIdActivity.some((data) => {
        return data.id === item.activity_id
      })

      if (!isExist) {
        throw new ValidationError("Activity ID not found")
      }

      const startDate = item.start_date
      const endDate = item.end_date
      if (
        (startDate && endDate && moment(startDate).isAfter(moment(endDate))) ||
        (!startDate && endDate)
      ) {
        throw new ValidationError("Invalid Date Range")
      }
    }

    this.#validateOverlapping(c, activities, listIdActivity)

    await next()
  })

  readonly #validateOverlapping = (
    c: Context,
    activities: any[],
    listIdActivity: any[]
  ) => {
    for (let i = 0; i < activities.length; i++) {
      for (let j = i + 1; j < activities.length; j++) {
        if (activities[i].activity_id === activities[j].activity_id) {
          this.#checkOverlap(c, activities[i], activities[j], listIdActivity)
        }
      }
    }
  }

  readonly #checkOverlap = (
    c: Context,
    activityA: any,
    activityB: any,
    listIdActivity: any[]
  ) => {
    const startA = activityA.start_date
      ? new Date(activityA.start_date).getTime()
      : null
    const endA = activityA.end_date
      ? new Date(activityA.end_date).getTime()
      : null
    const startB = activityB.start_date
      ? new Date(activityB.start_date).getTime()
      : null
    const endB = activityB.end_date
      ? new Date(activityB.end_date).getTime()
      : null

    if (this.#isOverlapping(startA, endA, startB, endB)) {
      const activityName = listIdActivity.find(
        (item) => item.id === activityA.activity_id
      )

      throw new ValidationError(
        c.var.t("activity.label.overlapping", {
          start_date: moment(startB).format("YYYY-MM-DD"),
          end_date: endB ? moment(endB).format("YYYY-MM-DD") : "null",
          activity_name: activityName.name,
          id: activityA.id,
        })
      )
    }
  }

  readonly #isOverlapping = (
    startA: number | null,
    endA: number | null,
    startB: number | null,
    endB: number | null
  ): boolean => {
    return (
      (startA !== null &&
        endA !== null &&
        startB !== null &&
        startA <= startB &&
        startB <= endA) ||
      (startA !== null &&
        endA === null &&
        startB !== null &&
        startB >= startA) ||
      (startB !== null && endB === null && startA !== null && startA >= startB)
    )
  }
}
