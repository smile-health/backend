import { MAP_ENTITY_TYPE_LABEL } from "@smile/lib/types/entity"
import { PaginatedResponse } from "@smile/lib/types/paginate.js"
import { GetEntityTypesQueries } from "./entity-type.schema.js"

export class EntityTypeModule {
  #paginateArray(array, pageNumber, pageSize): [] {
    // Calculate starting and ending index based on page number and size
    const startIndex = (pageNumber - 1) * pageSize
    const endIndex = startIndex + pageSize

    // Slice array based on calculated indices
    return array.slice(startIndex, endIndex)
  }

  async list(param: GetEntityTypesQueries) {
    const { page, paginate, keyword } = param
    const listEntityType = Object.entries(MAP_ENTITY_TYPE_LABEL).map(
      ([key, value]) => {
        return {
          id: Number(key),
          name: value,
        }
      }
    )

    const filterdEntityType = listEntityType.filter((item) => {
      if (keyword)
        return item.name.toUpperCase().includes(keyword.toUpperCase())

      return true
    })

    const paginateEntityType = this.#paginateArray(
      filterdEntityType,
      page,
      paginate
    )

    return new PaginatedResponse(
      param,
      paginateEntityType,
      filterdEntityType.length
    )
  }
}
