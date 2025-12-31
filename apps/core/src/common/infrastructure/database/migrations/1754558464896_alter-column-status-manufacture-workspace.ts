import { Kysely, sql } from "kysely"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .alterTable("manufacture_workspaces")
    .alterColumn("status", (col) => col.setDefault(sql`1`))
    .execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema
    .alterTable("manufacture_workspaces")
    .alterColumn("status", (col) => col.dropDefault())
    .execute()
}
