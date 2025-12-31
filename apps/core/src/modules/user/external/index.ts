import { EntityRepository } from "@/modules/entity/entity.repository"
import { RoleRepository } from "@/modules/role/role.repository"
import { UserRepository } from "../user.repository"
import { UserExternalController } from "./external.controller"
import { UserExternalModule } from "./external.module"

export const userExternalController = new UserExternalController(
  new UserExternalModule(
    new UserRepository(),
    new EntityRepository(),
    new RoleRepository()
  )
)
