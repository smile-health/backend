import { LOCATION } from "@/common/constants/location.js"
import { ValidationError } from "@smile-health/lib/error.js"
import { Context } from "hono"
import { RoleRepository } from "../role/role.repository.js"
import { MasterRepository } from "./master.repository.js"
import { TLocationPageable } from "./master.schema.js"

export class MasterModule {
  constructor(
    private readonly repository: MasterRepository,
    private readonly roleRepo: RoleRepository
  ) {}

  async getLocations(c: Context, param: TLocationPageable) {
    if (
      !param.parent_id &&
      (param.level == LOCATION.REGENCY ||
        param.level == LOCATION.SUBDISTRICT ||
        param.level == LOCATION.VILLAGE)
    ) {
      throw new ValidationError("parent_id is required")
    }

    return await this.repository.getLocations(c, param)
  }

  async getRoles(c: Context) {
    return await this.roleRepo.getRoles(c)
  }
}
