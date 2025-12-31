import { PaginatedResponse } from "@smile/lib/types/paginate.js"
import { Context } from "hono"
import { MaterialSubtypeRepository } from "./material-subtype.repository.js"
import {
  GetListMaterialSubtypeQueries,
  MaterialSubtypeItem,
} from "./material-subtype.schema.js"

export class MaterialSubtypeModule {
  constructor(private readonly repository: MaterialSubtypeRepository) {}

  async list(c: Context, params: GetListMaterialSubtypeQueries) {
    const { list, total } = await this.repository.getListMaterialSubtypes(
      c,
      params
    )

    const data: MaterialSubtypeItem[] = list.map((item) => ({
      subtype_id: Number(item.subtype_id),
      subtype_name: item.subtype_name,
    }))

    return new PaginatedResponse(params, data, total)
  }
}
