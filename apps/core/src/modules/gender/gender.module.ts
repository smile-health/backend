import { PaginatedResponse } from "@smile-health/lib/types/paginate.js"
import { Context } from "hono"
import { GenderRepository } from "./gender.repository.js"
import { GenderPaginatedRequestDTO } from "./gender.schema.js"

export class GenderModule {
  constructor(private readonly repo: GenderRepository) {}

  async list(c: Context, params: GenderPaginatedRequestDTO) {
    const { data, total } = await this.repo.findAll(c, params)
    if (!data.length) return new PaginatedResponse(params)

    const genders = data.map((el) => ({
      ...el,
      title: c.var.t(`gender.label.${el.id}`),
    }))

    return new PaginatedResponse(params, genders, total)
  }
}
