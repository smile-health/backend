import { PaginatedResponse } from "@smile/lib/types/paginate.js"
import { Context } from "hono"
import { GetMaterialUnitsQueryParams } from "../material-unit/material-unit.schema.js"
import { MaterialUnitRepository } from "./material-unit.repository.js"

export class MaterialUnitModule {
  constructor(private readonly repo: MaterialUnitRepository) {}

  async list(c: Context, queryParam: GetMaterialUnitsQueryParams) {
    const { data, total } = await this.repo.findAll(c, queryParam)

    if (data.length === 0) {
      return new PaginatedResponse(queryParam)
    }

    const materialUnits = data.map((materialUnit) => {
      return {
        ...materialUnit,
        name: c.var.t(`material_unit.label.${materialUnit.name}`),
      }
    })

    return new PaginatedResponse(queryParam, materialUnits, total)
  }
}
