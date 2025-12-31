import { MAP_USER_ROLE_LABEL } from "@/common/constants/user.js"
import { PaginatedResponse } from "@smile/lib/types/paginate.js"
import { Context } from "hono"
import { EntityUserRepository } from "./entity-user.repository.js"
import { GetEntitiesUsersQueries } from "./entity-user.schema.js"

export class EntityUserModule {
  constructor(private entityUserRepo: EntityUserRepository) { }

  async list(c: Context, params: GetEntitiesUsersQueries, id: number) {
    const [listEntityUser, totalCountEntityUser] = await Promise.all([
      this.entityUserRepo.getListEntityUser(c, params, id),
      this.entityUserRepo.getTotalCountEntityUser(c, params, id),
    ])

    const parsedListEntityUser = listEntityUser.map((entity) => {
      entity.role = MAP_USER_ROLE_LABEL[entity.role ?? "-"] || "-"
      return entity
    })

    return new PaginatedResponse(
      params,
      parsedListEntityUser,
      totalCountEntityUser
    )
  }
}
