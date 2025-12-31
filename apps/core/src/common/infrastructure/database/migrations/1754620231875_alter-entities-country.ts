import type { Kysely } from "kysely"
import { Database } from "../types"

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .alterTable("entities")
    .alterColumn("country", (col) => col.setDefault("ID"))
    .execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema
    .alterTable("entities")
    .alterColumn("country", (col) => col.dropDefault())
    .execute()
}
