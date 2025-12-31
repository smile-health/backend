import { Kysely } from "kysely"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .alterTable("ws_activities")
    .addColumn("protocol", "varchar(255)", (col) => col.defaultTo("default"))
    .addColumn("status", "boolean", (col) => col.defaultTo(true))
    .execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema
    .alterTable("ws_activities")
    .dropColumn("protocol")
    .dropColumn("status")
    .execute()
}
