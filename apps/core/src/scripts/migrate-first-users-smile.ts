import { AuthKeycloakService } from "@/modules/auth/auth.keycloak.service.js"
import { TCreateUserReq } from "@/modules/user/user.schema.js"
import { logger } from "@smile-health/lib/logger.js"
import { db } from "../common/infrastructure/database/index.js"

export const initiateFirstUsers = async () => {
  const user: TCreateUserReq = {
    username: "hrd_smile",
    email: "info@smile-indonesia.id",
    role: 1,
    firstname: "hrd_smile",
    lastname: "smile",
    mobile_phone: "+6282342934829",
    date_of_birth: new Date("2010-01-01"),
    gender: 1,
    village_id: "3276061001",
    address: "jln. test",
    entity_id: 3,
    password: "Smile12*",
    view_only: 0,
    status: 1,
  }

  // insert db and keycloak
  try {
    logger.info("starting insert first users")
    await db.transaction().execute(async (trx) => {
      const insert = await trx
        .insertInto("users")
        .values(user)
        .executeTakeFirst()

      const authKeycloak = await new AuthKeycloakService().createUser({
        ...user,
        role_label: "Super Admin",
        program_ids: ["1"],
      })

      trx
        .insertInto("user_workspaces")
        .values({
          user_id: Number(insert.insertId),
          workspace_id: 1,
        })
        .executeTakeFirst()
      trx
        .updateTable("users")
        .set({
          keycloak_uuid: authKeycloak.keycloak_uuid,
          user_uuid: authKeycloak.user_uuid,
        })
        .where("id", "=", Number(insert.insertId))
        .execute()
    })
    logger.info("finished insert first users")
  } catch (error) {
    console.error("migration failed")
    console.error(error)
    process.exit(1)
  }
}
