import { db } from "@/common/infrastructure/database/index.js"
import { RoleMappingDTO } from "@/modules/role/role-to-resource-mapping.schema.js"
import path from "path"

export const migrateRoleToResourceMapping = async () => {
  try {
    const fileJson = path.resolve("public", "role-to-resource-mapping.json")
    const readFileJson = Bun.file(fileJson)

    const contents = (await readFileJson.json()) as RoleMappingDTO[]

    console.log("migration started")
    await db.transaction().execute(async (trx) => {
      for (const roleMapping of contents) {
        const exist = await trx
          .selectFrom("roles_to_resource_mapping")
          .selectAll()
          .where((eb) =>
            eb.and({
              http_method: roleMapping.http_method,
              route_handler: roleMapping.route_handler,
              resource_type: roleMapping.resource_type,
            })
          )
          .executeTakeFirst()

        if (exist) {
          await trx
            .updateTable("roles_to_resource_mapping")
            .set({
              role_list: roleMapping.role_list,
              status: roleMapping.status,
            })
            .where((eb) =>
              eb.and({
                http_method: roleMapping.http_method,
                route_handler: roleMapping.route_handler,
                resource_type: roleMapping.resource_type,
              })
            )
            .executeTakeFirst()
        } else {
          await trx
            .insertInto("roles_to_resource_mapping")
            .values(roleMapping)
            .executeTakeFirst()
        }
      }
    })
  } catch (error) {
    console.error("migration failed:")
    console.error(error)
    process.exit(1)
  }

  console.log("migration finish")
}
