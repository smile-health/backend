import { Context } from "@smile-health/lib/types/context.js"
import { EntitySchoolPaginatedRequestDTO } from "./entity-school.schema.js"
import { DB } from "@/common/infrastructure/database/types/db.js"
import { SCHOOL_ENTITY_TAG_ID } from "@/common/constants/target.js"

export class EntitySchoolReposity {
  async getListEntityBySubDistrictAndEntityTag(
    c: Context<DB>,
    params: EntitySchoolPaginatedRequestDTO,
    entityTagId: number
  ) {
    const { keyword, sub_district_id } = params

    let baseQuery = c.var.trx
      .selectFrom("entities")
      .where("entity_tag_id", "=", entityTagId)
      .where((eb) =>
        eb.or([eb("name", "like", "MI%"), eb("name", "like", "SD%")])
      )
      .$if(Boolean(sub_district_id), (qr) =>
        qr.where("sub_district_id", "=", String(sub_district_id))
      )
      .select(["entities.id", "entities.name"])

    if (keyword && keyword != "") {
      baseQuery = baseQuery.where("name", "like", `%${keyword}%`)
    }

    const [list, totalList] = await Promise.all([
      baseQuery.execute(),
      baseQuery.select((qb) => qb.fn.countAll().as("total")).executeTakeFirst(),
    ])

    return { list, total: Number(totalList?.total) || 0 }
  }

  async getSchoolsBySubDistrict(c: Context<DB>, subDistrictId: number) {
    return await c.var.trx
      .selectFrom("entities")
      .where("entity_tag_id", "=", SCHOOL_ENTITY_TAG_ID)
      .where((eb) =>
        eb.or([eb("name", "like", "MI%"), eb("name", "like", "SD%")])
      )
      .where("sub_district_id", "=", String(subDistrictId))
      .select(["id", "name"])
      .execute()
  }
}
