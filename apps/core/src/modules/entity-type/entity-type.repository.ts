import { PaginatedResponse } from "@smile-health/lib/types/paginate.js"
import { Context } from "hono"
import { TEntityTypePageableRequest } from "./entity-type.schema.js"

export class EntityTypeRepository {
  readonly #mappingDataResultByLanguage = (c, data) => {
    return data.map((item) => {
      const name = c.var.t("entity_type.label." + item.name)
      return {
        ...item,
        name: name.includes("entity_type.label.") ? item.name : name,
      }
    })
  }

  async findAllPageable(c: Context, param: TEntityTypePageableRequest) {
    const { client, trx } = c.var
    const { page, paginate, keyword } = param
    const startIndex = (page - 1) * paginate
    const endIndex = startIndex + paginate

    const query = trx
      .selectFrom("entity_types as et")
      .where("et.deleted_at", "is", null)
      .$if(!!client, (qb) =>
        qb.innerJoin("integration_associations as a", (join) =>
          join
            .onRef("a.internal_id", "=", "et.id")
            .on("a.client_id", "=", client!.getId())
            .on("a.type", "=", "entity_type")
        )
      )

    let entityType = await query.select(["et.id", "et.name"]).execute()
    entityType = this.#mappingDataResultByLanguage(c, entityType)
    if (keyword) {
      entityType = entityType.filter((item) =>
        new RegExp(keyword, "i").test(item.name)
      )
    }
    return new PaginatedResponse(
      param,
      entityType.slice(startIndex, endIndex),
      Number(entityType.length)
    )
  }

  async findByIds(c: Context, ids: number[]) {
    const result = await c.var.trx
      .selectFrom("entity_types")
      .select(["id", "name"])
      .where("id", "in", ids)
      .execute()
    return new EntityTypeRepository().#mappingDataResultByLanguage(c, result)
  }

  async getEntityTypeStream(c: Context) {
    const result = await c.var.trx
      .selectFrom("entity_types")
      .select(["id", "name"])
      .where("deleted_at", "is", null)
      .execute()
    return new EntityTypeRepository().#mappingDataResultByLanguage(c, result)
  }
}
