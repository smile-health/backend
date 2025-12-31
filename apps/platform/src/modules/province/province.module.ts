import { PaginatedResponse } from "@smile/lib/types/paginate.js"
import { ProvinceRepository } from "./province.repository.js"
import { GetProvincesQueries } from "./province.schema.js"
import { Context } from "hono"

export class ProvinceModule {
  constructor(private provinceRepo: ProvinceRepository) { }

  async list(c: Context, param: GetProvincesQueries) {
    const [listProvince, totalProvince] = await Promise.all([
      this.provinceRepo.getListProvince(c, param),
      this.provinceRepo.getTotalCountProvince(c, param),
    ])

    return new PaginatedResponse(param, listProvince, totalProvince)
  }
}
