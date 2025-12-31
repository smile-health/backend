import { DB } from "@/common/infrastructure/database/types/db.js"
import { Context } from "@smile/lib/types/context.js"
import {
  GetEntityActivitiesQueries,
  SubmitEntityActivitiesRequest,
  InsertEntityActivityDateDTO,
  UpdateEntityActivityDateDTO,
} from "./entity-activity.schema.js"

export class EntityActivityRepository {
  async getListEntityActivity(
    c: Context<DB>,
    id: number,
    params: GetEntityActivitiesQueries
  ) {
    const { keyword } = params
    let query = c.var.trx
      .selectFrom("master_activities as ma")
      .innerJoin("entity_activity_date as ead", (join) =>
        join
          .onRef("ead.activity_id", "=", "ma.id")
          .on("ead.deleted_at", "is", null)
      )
      .where("ead.entity_id", "=", id)
      .where("ma.deleted_at", "is", null)

    if (keyword) {
      query = query.where("ma.name", "like", `%${keyword}%`)
    }

    return query
      .select(["ma.id", "ma.name", "ead.join_date", "ead.end_date"])
      .orderBy("ma.id")
      .execute()
  }

  async getListActivity(c: Context<DB>) {
    return c.var.trx
      .selectFrom("master_activities")
      .where("deleted_at", "is", null)
      .select(["id"])
      .execute()
  }

  async getListEntityActivityDate(
    c: Context<DB>,
    params: SubmitEntityActivitiesRequest
  ) {
    const { entity_id } = params
    return c.var.trx
      .selectFrom("entity_activity_date")
      .where("entity_id", "=", entity_id)
      .where("deleted_at", "is", null)
      .select(["entity_id", "activity_id"])
      .execute()
  }

  async insertActivities(c: Context<DB>, data: InsertEntityActivityDateDTO[]) {
    return c.var.trx.insertInto("entity_activity_date").values(data).execute()
  }

  async updateActivities(c: Context<DB>, data: UpdateEntityActivityDateDTO[]) {
    for (const item of data) {
      await c.var.trx
        .updateTable("entity_activity_date")
        .set({
          join_date: item.join_date,
          end_date: item.end_date,
          updated_at: new Date(),
        })
        .where("activity_id", "=", item.activity_id)
        .where("deleted_at", "is", null)
        .execute()
    }
  }
}
