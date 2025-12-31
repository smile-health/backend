import { PaginatedResponse } from "@smile/lib/types/paginate.js"
import { Context } from "hono"
import { TLocationPageable } from "./master.schema.js"

export class MasterRepository {
  async getLocations(c: Context, params: TLocationPageable) {
    let q = c.var.trx
      .selectFrom("locations")
      .selectAll()
      .where("level", "=", params.level!)
      .$if(params.parent_id![0]! > 0, (eb) =>
        eb.where("parent_id", "in", params.parent_id!)
      )

    if (params.keyword) {
      q = q.where("name", "like", `%${params.keyword}%`)
    }

    const offset = (params.page - 1) * params.paginate
    const [locations, count] = await Promise.all([
      q.limit(params.paginate).offset(offset).execute(),
      q.select((fn) => fn.fn.countAll().as("total")).executeTakeFirstOrThrow(),
    ])

    return new PaginatedResponse(params, locations, Number(count.total))
  }

  async findLocationsByIds(c: Context, locationIDs: number[]) {
    return await c.var.trx
      .selectFrom("locations")
      .where("id", "in", locationIDs)
      .selectAll()
      .execute()
  }
}
