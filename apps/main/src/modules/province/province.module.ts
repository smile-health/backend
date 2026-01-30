import { PaginatedResponse } from "@smile-health/lib/types/paginate.js"
import { Context } from "hono"
import { ProvinceRepository } from "./province.repository.js"
import { GetProvincesQueries } from "./province.schema.js"

export class ProvinceModule {
  constructor(private readonly provinceRepo: ProvinceRepository) { }

  async list(c: Context, param: GetProvincesQueries) {
    const [listProvince, totalProvince] = await Promise.all([
      this.provinceRepo.getListProvince(c, param),
      this.provinceRepo.getTotalCountProvince(c, param),
    ])

    return new PaginatedResponse(param, listProvince, totalProvince)
  }
}
