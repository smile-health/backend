import { AuthKeycloakService } from "@/modules/auth/auth.keycloak.service.js"
import { logger } from "@smile-health/lib/logger.js"
import bcrypt from "bcrypt"
import { db } from "../common/infrastructure/database/index.js"

export const initiateFirstUsers = async () => {
  const plainPassword = "Smile12*"
  const hashedPassword = await bcrypt.hash(plainPassword, 10)

  // User data for database upsert
  const userData = {
    username: "admin",
    email: "admin@smile-indonesia.id",
    role: 1,
    firstname: "admin",
    lastname: "smile",
    mobile_phone: "+6282342934829",
    date_of_birth: new Date("2010-01-01"),
    gender: 1,
    village_id: "3276061001",
    address: "jln. test",
    entity_id: 3,
    password: hashedPassword,
    view_only: 0,
    status: 1,
  }

  // Check Keycloak connection before proceeding
  try {
    logger.info("checking Keycloak connection...")
    const authService = new AuthKeycloakService(
      process.env.AUTH_URL ?? "http://localhost:5001"
    )
    await authService.checkConnection()
    logger.info("Keycloak connection successful")
  } catch (connectionError) {
    logger.error("Keycloak connection failed")
    console.error(connectionError)
    process.exit(1)
  }

  try {
    logger.info("starting upsert first users")

    await db.transaction().execute(async (trx) => {
      // Check if user already exists by username or email
      const existingUser = await trx
        .selectFrom("users")
        .select(["id", "keycloak_uuid", "user_uuid"])
        .where((eb) =>
          eb.or([
            eb("username", "=", userData.username),
            eb("email", "=", userData.email),
          ])
        )
        .executeTakeFirst()

      let userId: number
      let keycloakUuid: string | null = null

      if (existingUser) {
        logger.info(
          `User already exists with id: ${existingUser.id}, updating...`
        )

        // Update existing user
        await trx
          .updateTable("users")
          .set({
            ...userData,
            updated_at: new Date(),
          })
          .where("id", "=", existingUser.id)
          .execute()

        userId = existingUser.id
        keycloakUuid = existingUser.keycloak_uuid

        // Update user in Keycloak if keycloak_uuid exists
        if (keycloakUuid) {
          try {
            await authService.updateUser(keycloakUuid, {
              username: userData.username,
              firstname: userData.firstname,
              lastname: userData.lastname,
              email: userData.email,
              password: plainPassword,
              role_label: "Super Admin",
              program_ids: ["1"],
            })
            logger.info(`Updated existing user in Keycloak: ${keycloakUuid}`)
          } catch (keycloakError) {
            logger.warn(`Failed to update user in Keycloak: ${keycloakError}`)
          }
        } else {
          // User exists in DB but not in Keycloak, create in Keycloak
          const authKeycloak = await authService.createUser({
            username: userData.username,
            firstname: userData.firstname,
            lastname: userData.lastname,
            email: userData.email,
            password: plainPassword,
            role_label: "Super Admin",
            program_ids: ["1"],
          })

          await trx
            .updateTable("users")
            .set({
              keycloak_uuid: authKeycloak.keycloak_uuid,
              user_uuid: authKeycloak.user_uuid,
            })
            .where("id", "=", userId)
            .execute()

          logger.info(`Created user in Keycloak: ${authKeycloak.keycloak_uuid}`)
        }

        // Check if user_workspace exists, insert if not
        const existingWorkspace = await trx
          .selectFrom("user_workspaces")
          .select("id")
          .where("user_id", "=", userId)
          .where("workspace_id", "=", 1)
          .executeTakeFirst()

        if (!existingWorkspace) {
          await trx
            .insertInto("user_workspaces")
            .values({
              user_id: userId,
              workspace_id: 1,
            })
            .executeTakeFirst()
          logger.info(`Added user to workspace 1`)
        }
      } else {
        logger.info("Creating new user...")

        // Insert new user
        const insert = await trx
          .insertInto("users")
          .values(userData)
          .executeTakeFirst()

        userId = Number(insert.insertId)

        // Create user in Keycloak
        const authKeycloak = await authService.createUser({
          username: userData.username,
          firstname: userData.firstname,
          lastname: userData.lastname,
          email: userData.email,
          password: plainPassword,
          role_label: "Super Admin",
          program_ids: ["1"],
        })

        // Update user with Keycloak UUIDs
        await trx
          .updateTable("users")
          .set({
            keycloak_uuid: authKeycloak.keycloak_uuid,
            user_uuid: authKeycloak.user_uuid,
          })
          .where("id", "=", userId)
          .execute()

        // Add to workspace
        await trx
          .insertInto("user_workspaces")
          .values({
            user_id: userId,
            workspace_id: 1,
          })
          .executeTakeFirst()

        logger.info(
          `Created new user in Keycloak: ${authKeycloak.keycloak_uuid}`
        )
      }
    })

    logger.info("finished upsert first users")
    process.exit(0)
  } catch (error) {
    console.error("migration failed")
    console.error(error)
    process.exit(1)
  }
}
