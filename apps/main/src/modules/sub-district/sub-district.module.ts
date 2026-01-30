import { PaginatedResponse } from "@smile-health/lib/types/paginate.js"
import { Context } from "hono"
import { SubDistrictRepository } from "./sub-district.repository.js"
import { GetSubDistrictsQueries } from "./sub-district.schema.js"

export class SubDistrictModule {
  constructor(private readonly subDistrictRepo: SubDistrictRepository) { }

  async list(c: Context, param: GetSubDistrictsQueries) {
    const [listSubDistrict, totalSubDistrict] = await Promise.all([
      this.subDistrictRepo.getListSubDistrict(c, param),
      this.subDistrictRepo.getTotalCountSubDistrict(c, param),
    ])

    return new PaginatedResponse(param, listSubDistrict, totalSubDistrict)
  }
}
