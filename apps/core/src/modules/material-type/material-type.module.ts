import { PaginatedResponse } from "@smile/lib/types/paginate.js"
import { Context } from "hono"
import { GetMaterialRelationsQueryParams } from "../material-relation/material-relation.schema.js"
import { MaterialTypeRepository } from "./material-type.repository.js"

export class MaterialTypeModule {
  constructor(private readonly repo: MaterialTypeRepository) {}

  async list(c: Context, queryParam: GetMaterialRelationsQueryParams) {
    const { data, total } = await this.repo.findAll(c, queryParam)

    if (data.length === 0) {
      return new PaginatedResponse(queryParam)
    }

    const materialTypes = data.map((materialType) => {
      return {
        ...materialType,
        name: c.var.t(`material_type.label.${materialType.name}`),
      }
    })

    return new PaginatedResponse(queryParam, materialTypes, total)
  }
}
