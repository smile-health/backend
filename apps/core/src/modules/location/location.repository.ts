import { LOCATION_KEY } from "@/common/constants/location.js"
import { DB } from "@/common/infrastructure/database/types/db.js"
import { Context as CtxLib } from "@smile-health/lib/types/context.js"
import { Context } from "hono"

export class LocationRepository {
  async getLocations(c: Context, level: number, parentID: number = 0) {
    return await c.var.trx
      .selectFrom("locations")
      .selectAll()
      .where("level", "=", level)
      .$if(parentID > 0, (eb) => eb.where("parent_id", "=", parentID))
      .execute()
  }

  async findByID(c: Context, locationID: number = 0) {
    return await c.var.trx
      .selectFrom("locations")
      .selectAll()
      .where("id", "=", locationID)
      .executeTakeFirst()
  }

  async findByIDs(c: Context, locationIDs: number[], level: number = -1) {
    return await c.var.trx
      .selectFrom("locations")
      .selectAll()
      .where("id", "in", locationIDs)
      .$if(level >= 0, (eb) => eb.where("level", "=", level))
      .execute()
  }

  async findByName(c: Context, name: string, level: number = -1) {
    return await c.var.trx
      .selectFrom("locations")
      .selectAll()
      .where("name", "=", name)
      .$if(level >= 0, (eb) => eb.where("level", "=", level))
      .executeTakeFirst()
  }

  async getDetails(c: Context, locationID: number) {
    const detail = {}
    let parentID = -1

    while (parentID !== 0) {
      const location = await this.findByID(
        c,
        parentID > 0 ? parentID : locationID
      )
      if (!location) {
        break
      }

      const key = LOCATION_KEY[location.level ?? -1] ?? ""
      detail[key] = {
        id: location.id,
        name: location.name,
      }

      parentID = location.parent_id ?? 0
    }

    return detail
  }

  async getDistrictStream(c: CtxLib<DB>) {
    return c.var.trx
      .selectFrom("locations")
      .where("level", "=", 3)
      .select(["id", "name"])
      .stream()
  }

  getLocationByLevelStream(c: CtxLib<DB>, level: number) {
    return c.var.trx
      .selectFrom("locations")
      .where("level", "=", level)
      .select(["id", "name"])
      .orderBy("id", "asc")
      .stream()
  }
}
