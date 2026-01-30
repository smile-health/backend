import { Context } from "hono"
import { EntitySchoolReposity } from "./entity-school.repository.js"
import { EntitySchoolPaginatedRequestDTO } from "./entity-school.schema.js"
import { PaginatedResponse } from "@smile-health/lib/types/paginate.js"
import { SCHOOL_ENTITY_TAG_ID } from "@/common/constants/target.js"

export class EntitySchoolModule {
  constructor(private readonly entitySchoolRepositoty: EntitySchoolReposity) {}

  async list(c: Context, params: EntitySchoolPaginatedRequestDTO) {
    const { list, total } =
      await this.entitySchoolRepositoty.getListEntityBySubDistrictAndEntityTag(
        c,
        params,
        SCHOOL_ENTITY_TAG_ID
      )

    return new PaginatedResponse(params, list, total)
  }
}
