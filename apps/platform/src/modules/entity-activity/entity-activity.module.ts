import { Context } from "hono"
import moment from "moment"
import { EntityActivityRepository } from "./entity-activity.repository.js"
import {
  GetEntityActivitiesQueries,
  SubmitEntityActivitiesRequest,
  InsertEntityActivityDateDTO,
  UpdateEntityActivityDateDTO,
} from "./entity-activity.schema.js"
import { ValidationError } from "@smile/lib/error.js"

export class EntityActivityModule {
  constructor(private entityActivityRepo: EntityActivityRepository) {}
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

  async list(c: Context, id: number, params: GetEntityActivitiesQueries) {
    const listEntityActivity =
      await this.entityActivityRepo.getListEntityActivity(c, id, params)

    const parsedListEntityActivity = listEntityActivity.map((item) => {
      return {
        id: item.id,
        name: item.name,
        join_date: item.join_date
          ? moment(item.join_date).format("YYYY-MM-DD")
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
      await this.entityActivityRepo.getListEntityActivityDate(c, params)
    const insertData: InsertEntityActivityDateDTO[] = []
    const updateData: UpdateEntityActivityDateDTO[] = []
    activities.forEach((item) => {
      const isExist = listEntityActivityDate.some(
        (data) => data.activity_id === item.activity_id
      )

      if (isExist) {
        updateData.push(item)
      } else {
        const object = {
          entity_id,
          activity_id: item.activity_id,
          join_date: item.join_date,
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

    const notif = this.#generateStatusNotif(isInsert, isUpdate)

    return { message: notif }
  }
}
