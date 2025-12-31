import { PaginatedResponse } from "@smile/lib/types/paginate.js"
import { VillageRepository } from "./village.repository.js"
import { GetVillagesQueries } from "./village.schema.js"
import { Context } from "hono"

export class VillageModule {
  constructor(private villageRepo: VillageRepository) { }

  async list(c: Context, param: GetVillagesQueries) {
    const [listVillage, totalVillage] = await Promise.all([
      this.villageRepo.getListVillage(c, param),
      this.villageRepo.getTotalCountVillage(c, param),
    ])

    return new PaginatedResponse(param, listVillage, totalVillage)
  }
}
