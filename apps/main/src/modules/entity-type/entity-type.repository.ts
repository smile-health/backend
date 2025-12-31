import { PaginatedResponse } from "@smile/lib/types/paginate.js"
import { Context } from "hono"
import { GetEntityTypesQueries } from "./entity-type.schema.js"

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

  async findAll(c: Context, param: GetEntityTypesQueries) {
    const { page, paginate, keyword } = param
    const startIndex = (page - 1) * paginate
    const endIndex = startIndex + paginate

    const query = c.var.trx
      .selectFrom("entity_types")
      .where("deleted_at", "is", null)

    let entityType = await query.select(["id", "name"]).execute()
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

  async findByIds(c: Context, ids?: number[]) {
    if (!ids || ids.length === 0) {
      return []
    }

    const result = await c.var.trx
      .selectFrom("entity_types")
      .select(["id", "name"])
      .where("id", "in", ids)
      .execute()
    return new EntityTypeRepository().#mappingDataResultByLanguage(c, result)
  }
}
