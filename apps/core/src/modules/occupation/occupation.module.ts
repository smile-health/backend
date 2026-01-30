import { PaginatedResponse } from "@smile-health/lib/types/paginate.js"
import { Context } from "hono"
import { OccupationRepository } from "./occupation.repository.js"
import { OccupationPaginatedRequestDTO } from "./occupation.schema.js"

export class OccupationModule {
  constructor(private readonly repo: OccupationRepository) {}

  async list(c: Context, params: OccupationPaginatedRequestDTO) {
    const { data, total } = await this.repo.findAll(c, params)
    if (!data.length) return new PaginatedResponse(params)

    const occupations = data.map((el) => ({
      ...el,
      title: c.var.t(`occupation.label.${el.title}`),
    }))

    return new PaginatedResponse(params, occupations, total)
  }
}
