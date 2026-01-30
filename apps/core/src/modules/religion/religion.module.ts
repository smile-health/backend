import { PaginatedResponse } from "@smile-health/lib/types/paginate.js"
import { Context } from "hono"
import { ReligionRepository } from "./religion.repository.js"
import { ReligionPaginatedRequestDTO } from "./religion.schema.js"

export class ReligionModule {
  constructor(private readonly repo: ReligionRepository) {}

  async list(c: Context, params: ReligionPaginatedRequestDTO) {
    const { data, total } = await this.repo.findAll(c, params)
    if (!data.length) return new PaginatedResponse(params)

    const religions = data.map((el) => ({
      ...el,
      title: c.var.t(`religion.label.${el.title}`),
    }))

    return new PaginatedResponse(params, religions, total)
  }
}
