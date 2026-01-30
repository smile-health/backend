import { MAP_USER_ROLE_LABEL } from "@/common/constants/user.js"
import { PaginatedResponse } from "@smile-health/lib/types/paginate.js"
import { Context } from "hono"
import { EntityUserRepository } from "./entity-user.repository.js"
import { GetEntitiesUsersQueries } from "./entity-user.schema.js"

export class EntityUserModule {
  constructor(private readonly entityUserRepo: EntityUserRepository) {}

  async list(c: Context, params: GetEntitiesUsersQueries, id: number) {
    const programId = c.var.programId
    const { list, total } = await this.entityUserRepo.getListEntityUser(
      c,
      params,
      id,
      programId
    )

    const parsedListEntityUser = list.map((entity) => {
      entity.role = MAP_USER_ROLE_LABEL[entity.role ?? "-"] || "-"
      return entity
    })

    return new PaginatedResponse(params, parsedListEntityUser, total)
  }
}
