import { PaginatedResponse } from "@smile-health/lib/types/paginate.js"
import { Context } from "hono"
import { MaritalStatusRepository } from "./marital-status.repository.js"
import { MaritalStatusPaginatedRequestDTO } from "./marital-status.schema.js"

export class MaritalStatusModule {
  constructor(private readonly repo: MaritalStatusRepository) {}

  async list(c: Context, params: MaritalStatusPaginatedRequestDTO) {
    const { data, total } = await this.repo.findAll(c, params)
    if (!data.length) return new PaginatedResponse(params)

    const maritalStatus = data.map((el) => ({
      ...el,
      title: c.var.t(`marital_status.label.${el.title}`),
    }))

    return new PaginatedResponse(params, maritalStatus, total)
  }
}
