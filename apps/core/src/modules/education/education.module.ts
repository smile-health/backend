import { PaginatedResponse } from "@smile-health/lib/types/paginate.js"
import { Context } from "hono"
import { EducationRepository } from "./education.repository.js"
import { EducationPaginatedRequestDTO } from "./education.schema.js"

export class EducationModule {
  constructor(private readonly repo: EducationRepository) {}

  async list(c: Context, params: EducationPaginatedRequestDTO) {
    const { data, total } = await this.repo.findAll(c, params)
    if (!data.length) return new PaginatedResponse(params)

    const educations = data.map((el) => ({
      ...el,
      title: c.var.t(`education.label.${el.title}`),
    }))

    return new PaginatedResponse(params, educations, total)
  }
}
