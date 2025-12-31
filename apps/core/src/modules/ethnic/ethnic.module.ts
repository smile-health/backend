import { PaginatedResponse } from "@smile/lib/types/paginate.js"
import { Context } from "hono"
import { EthnicRepository } from "./ethnic.repository.js"
import { EthnicPaginatedRequestDTO } from "./ethnic.schema.js"

export class EthnicModule {
  constructor(private readonly repo: EthnicRepository) {}

  async list(c: Context, params: EthnicPaginatedRequestDTO) {
    const { data, total } = await this.repo.findAll(c, params)
    if (!data.length) return new PaginatedResponse(params)

    const ethnics = data.map((el) => ({
      ...el,
      title: c.var.t(`ethnic.label.${el.title}`),
    }))

    return new PaginatedResponse(params, ethnics, total)
  }
}
