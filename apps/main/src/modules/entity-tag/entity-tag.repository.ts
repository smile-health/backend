import { DB } from "@/common/infrastructure/database/types/db.js"
import { Context } from "@smile-health/lib/types/context.js"
import { PaginatedResponse } from "@smile-health/lib/types/paginate.js"
import { GetEntityTagsQueries } from "./entity-tag.schema.js"

export class EntityTagRepository {
  readonly #mappingDataResultByLanguage = (c, data) => {
    return data.map((item) => {
      const title = c.var.t("entity_tag.label." + item.title)
      return {
        ...item,
        title: title.includes("entity_tag.label.") ? item.title : title,
      }
    })
  }

  async findAll(c: Context<DB>, param: GetEntityTagsQueries) {
    const { page, paginate, keyword } = param
    const startIndex = (page - 1) * paginate
    const endIndex = startIndex + paginate

    const query = c.var.trx
      .selectFrom("entity_tags")
      .where("deleted_at", "is", null)

    let entityTags = await query.select(["id", "title"]).execute()
    entityTags = this.#mappingDataResultByLanguage(c, entityTags)
    if (keyword) {
      entityTags = entityTags.filter((item) =>
        new RegExp(keyword, "i").test(item.title!)
      )
    }
    return new PaginatedResponse(
      param,
      entityTags.slice(startIndex, endIndex),
      Number(entityTags.length)
    )
  }

  async findById(c: Context<DB>, id: number[]) {
    const result = await c.var.trx
      .selectFrom("entity_tags")
      .selectAll()
      .where("id", "in", id)
      .execute()
    return this.#mappingDataResultByLanguage(c, result)
  }
}
