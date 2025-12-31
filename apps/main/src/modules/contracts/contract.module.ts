import { PaginatedResponse } from "@smile/lib/types/paginate.js"
import { Context } from "hono"
import { ContractRepository } from "./contract.repository.js"
import { GetListContractQueries } from "./contract.schema.js"

export class ContractModule {
  constructor(private readonly repo: ContractRepository) {}

  async list(c: Context, params: GetListContractQueries) {
    const { list, total } = await this.repo.getList(c, params)

    return new PaginatedResponse(params, list, total)
  }
}
