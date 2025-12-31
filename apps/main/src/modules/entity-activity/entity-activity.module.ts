import { ValidationError } from "@smile/lib/error.js"
import { Context } from "hono"
import moment from "moment"
import { EntityActivityPublisher } from "./entity-activity.publisher.js"
import { EntityActivityRepository } from "./entity-activity.repository.js"
import {
  GetEntityActivitiesAdditionalQueries,
  InsertEntityActivityDateDTO,
  SubmitEntityActivitiesRequest,
  UpdateEntityActivityDateDTO,
} from "./entity-activity.schema.js"

export class EntityActivityModule {
  constructor(
    private readonly entityActivityRepo: EntityActivityRepository,
    private readonly publisher: EntityActivityPublisher
  ) {}
  #generateStatusNotif(isInsert: boolean, isUpdate: boolean) {
    let notif
    if (isInsert && isUpdate) {
      notif = "SUCCESSFULLY INSERT AND UPDATE DATA"
    } else if (isUpdate) {
      notif = "SUCCESSFULLY UPDATE DATA"
    } else if (isInsert) {
      notif = "SUCCESSFULLY INSERT DATA"
    } else {
      throw new ValidationError("NOT FOUND DATA")
    }

    return notif
  }

  async #insertDataActivity(c: Context, data: InsertEntityActivityDateDTO[]) {
    let isInsert = false
    if (data.length > 0) {
      await this.entityActivityRepo.insertActivities(c, data)
      isInsert = true
    }

    return isInsert
  }

  async #updateDataActivity(c: Context, data: UpdateEntityActivityDateDTO[]) {
    let isUpdate = false
    if (data.length > 0) {
      await this.entityActivityRepo.updateActivities(c, data)
      isUpdate = true
    }

    return isUpdate
  }

  #handleOverlapping(
    c: Context,
    dataExisting: any[],
    params: SubmitEntityActivitiesRequest
  ) {
    const listEntityActivityDate = dataExisting
    const { activities } = params

    const isOverlapping = (
      startDateNew: string,
      endDateNew: string,
      activityId: number
    ): { isOverlap: boolean; conflictId?: number } => {
      for (const {
        start_date,
        end_date,
        id: idExisting,
        activity_id: activityIdExisting,
      } of listEntityActivityDate) {
        if (activityIdExisting !== activityId) continue

        const newStart = moment(startDateNew)
        const newEnd = endDateNew ? moment(endDateNew) : newStart
        const existingStart = moment(start_date)
        const existingEnd = moment(end_date)

        if (
          newStart.isBetween(existingStart, existingEnd, undefined, "[]") ||
          newEnd.isBetween(existingStart, existingEnd, undefined, "[]") ||
          (newStart.isBefore(existingStart) && newEnd.isAfter(existingEnd)) ||
          (existingStart.isBetween(newStart, newEnd, undefined, "[]") &&
            existingEnd.isBetween(newStart, newEnd, undefined, "[]"))
        ) {
          return { isOverlap: true, conflictId: idExisting }
        }
      }
      return { isOverlap: false }
    }

    for (const item of activities) {
      const { isOverlap, conflictId } = isOverlapping(
        item.start_date,
        item.end_date,
        item.activity_id
      )

      if (isOverlap) {
        if (item.id === conflictId) {
          continue
        }
        const isNameActivity = listEntityActivityDate.find((data) => {
          return data.activity_id === item.activity_id
        })

        throw new ValidationError(
          c.var.t("activity.label.overlapping", {
            start_date: moment(item.start_date).format("YYYY-MM-DD"),
            end_date: item.end_date
              ? moment(item.end_date).format("YYYY-MM-DD")
              : "null",
            activity_name: isNameActivity.name,
            id: item.id,
          })
        )
      }
    }
  }

  async list(
    c: Context,
    id: number,
    params: GetEntityActivitiesAdditionalQueries
  ) {
    const listEntityActivity =
      await this.entityActivityRepo.getListEntityActivity(
        c,
        id,
        params,
        c.get("programId")
      )

    const parsedListEntityActivity = listEntityActivity.map((item) => {
      return {
        ...item,
        start_date: item.start_date
          ? moment(item.start_date).format("YYYY-MM-DD")
          : "",
        end_date: item.end_date
          ? moment(item.end_date).format("YYYY-MM-DD")
          : "",
      }
    })

    return parsedListEntityActivity
  }

  async submit(c: Context, params: SubmitEntityActivitiesRequest) {
    const { entity_id, activities } = params
    const listEntityActivityDate =
      await this.entityActivityRepo.getListEntityActivityDate(
        c,
        params,
        c.get("programId")
      )

    const insertData: InsertEntityActivityDateDTO[] = []
    const updateData: UpdateEntityActivityDateDTO[] = []

    this.#handleOverlapping(c, listEntityActivityDate, params)

    activities.forEach((item) => {
      const isExist = listEntityActivityDate.some((data) => {
        if (data.activity_id === item.activity_id && data.id === item.id) {
          if (
            item.end_date &&
            moment(item.end_date).format("YYYY-MM-DD") !==
              moment(data.end_date).format("YYYY-MM-DD")
          ) {
            const endDate = item.end_date
            const currentDate = moment().startOf("day")

            if (endDate && moment(endDate).isBefore(currentDate)) {
              throw new ValidationError(
                "End date cannot be before the current date"
              )
            }
          }
          return true
        }
        return false
      })

      if (isExist) {
        updateData.push(item)
      } else {
        const object = {
          entity_id,
          activity_id: item.activity_id,
          start_date: item.start_date,
          end_date: item.end_date,
          created_at: new Date(),
          updated_at: new Date(),
        }

        insertData.push(object)
      }
    })

    const [isInsert, isUpdate] = await Promise.all([
      this.#insertDataActivity(c, insertData),
      this.#updateDataActivity(c, updateData),
    ])

    await this.publisher.processUpdate(c, params)

    const notif = this.#generateStatusNotif(isInsert, isUpdate)

    return { message: notif }
  }
}
