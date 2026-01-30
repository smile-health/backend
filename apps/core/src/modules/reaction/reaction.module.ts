import { PaginatedResponse } from "@smile-health/lib/types/paginate.js"
import { Context } from "hono"
import { ReactionRepository } from "./reaction.repository.js"
import { ReactionPaginatedRequestDTO } from "./reaction.schema.js"

export class ReactionModule {
  constructor(private readonly repo: ReactionRepository) {}

  async list(c: Context, params: ReactionPaginatedRequestDTO) {
    const { data, total } = await this.repo.findAll(c, params)
    if (!data.length) return new PaginatedResponse(params)

    const reactions = data.map((el) => ({
      ...el,
      title: c.var.t(`reaction.label.${el.title}`),
    }))

    return new PaginatedResponse(params, reactions, total)
  }
}
