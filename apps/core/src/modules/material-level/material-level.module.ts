import { PaginatedResponse } from "@smile-health/lib/types/paginate.js"
import { Context } from "hono"
import { MaterialLevelRepository } from "./material-level.repository.js"
import { GetMaterialLevelsQueryParams } from "./material-level.schema.js"

export class MaterialLevelModule {
  constructor(private readonly repo: MaterialLevelRepository) {}

  async list(c: Context, queryParam: GetMaterialLevelsQueryParams) {
    const { data, total } = await this.repo.findAll(c, queryParam)

    if (data.length === 0) {
      return new PaginatedResponse(queryParam)
    }

    const materialLevels = data.map((material) => {
      return {
        ...material,
        name: c.var.t(`material_level.label.${material.name}`),
      }
    })

    return new PaginatedResponse(queryParam, materialLevels, total)
  }
}
