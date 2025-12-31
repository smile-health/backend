import { Context } from "hono"
import { GetCceigatQueryParams } from "./ccigat.schema"
import { PaginatedResponse } from "@smile/lib/types/paginate"
import { CceigatRepository } from "./cceigat.repository"

export class CceigatModule {
  constructor(private readonly repository: CceigatRepository) {}

  async list(c: Context, queryParam: GetCceigatQueryParams) {
    const { data, total } = await this.repository.findAll(c, queryParam)

    if (data.length === 0) {
      return new PaginatedResponse(queryParam)
    }

    return new PaginatedResponse(queryParam, data, total)
  }
}
