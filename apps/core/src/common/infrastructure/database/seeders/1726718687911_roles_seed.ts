import { Kysely } from "kysely"
import { Database } from "../types/index.js"

export async function seed(db: Kysely<Database>): Promise<void> {
  const roles = [
    { id: 1, name: "Super Admin" },
    { id: 2, name: "Admin" },
    { id: 3, name: "Manager" },
    { id: 4, name: "Operator" },
  ]

  for (const role of roles) {
    await db
      .insertInto("roles")
      .values(role)
      .onDuplicateKeyUpdate({
        name: role.name,
      })
      .execute()
  }
}
