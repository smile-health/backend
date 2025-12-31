import { Kysely } from "kysely"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .alterTable("entity_tags")
    .addColumn("is_open_vial", "boolean", (col) => col.defaultTo(false))
    .execute()
  await db
    .updateTable("entity_tags")
    .set({ is_open_vial: 1 })
    .where("title", "=", "in_building")
    .execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.alterTable("entity_tags").dropColumn("is_open_vial").execute()
}
