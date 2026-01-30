import { PaginatedResponse } from "@smile-health/lib/types/paginate.js"
import { Context } from "hono"
import { RegencyRepository } from "./regency.repository.js"
import { GetRegenciesQueries } from "./regency.schema.js"

export class RegencyModule {
  constructor(private readonly regencyRepo: RegencyRepository) { }

  async list(c: Context, param: GetRegenciesQueries) {
    const [listRegency, totalRegency] = await Promise.all([
      this.regencyRepo.getListRegency(c, param),
      this.regencyRepo.getTotalCountRegency(c, param),
    ])

    return new PaginatedResponse(param, listRegency, totalRegency)
  }
}
