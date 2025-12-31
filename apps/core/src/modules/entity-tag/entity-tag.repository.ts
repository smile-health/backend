import {
  EntityTagDtos,
  TEntityTagPageableRequest,
} from "@/modules/entity-tag/entity-tag.schema.js"
import { PaginatedResponse } from "@smile/lib/types/paginate.js"
import { Context } from "hono"

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

  async findAll(c: Context, param: TEntityTagPageableRequest) {
    const { page, paginate, keyword } = param
    const startIndex = (page - 1) * paginate
    const endIndex = startIndex + paginate
    const { client, trx } = c.var

    const query = trx
      .selectFrom("entity_tags as et")
      .$if(!!client, (qb) =>
        qb.innerJoin("integration_associations as a", (join) =>
          join
            .onRef("a.internal_id", "=", "et.id")
            .on("a.client_id", "=", client!.getId())
            .on("a.type", "=", "entity_tag")
        )
      )
      .where("et.deleted_at", "is", null)

    let entityTags = await query.select(["et.id", "et.title"]).execute()
    entityTags = this.#mappingDataResultByLanguage(c, entityTags)
    if (keyword) {
      entityTags = entityTags.filter((item) =>
        new RegExp(keyword, "i").test(item.title!)
      )
    }
    return new PaginatedResponse(
      param,
      EntityTagDtos.parse(entityTags.slice(startIndex, endIndex)),
      Number(entityTags.length)
    )
  }

  async findById(c: Context, entityTagID: number) {
    const result = await c.var.trx
      .selectFrom("entity_tags")
      .where("id", "=", entityTagID)
      .selectAll()
      .executeTakeFirst()
    if (!result) return result
    return this.#mappingDataResultByLanguage(c, [result])[0]
  }

  async findByIds(c: Context, entityTagIDs: number[]) {
    const result = await c.var.trx
      .selectFrom("entity_tags")
      .where("id", "in", entityTagIDs)
      .selectAll()
      .execute()
    return new EntityTagRepository().#mappingDataResultByLanguage(c, result)
  }

  async getEntityTagStream(c: Context) {
    const result = await c.var.trx
      .selectFrom("entity_tags")
      .select(["id", "title"])
      .where("deleted_at", "is", null)
      .execute()
    return new EntityTagRepository().#mappingDataResultByLanguage(c, result)
  }
}
