import type { Kysely } from "kysely"
import { Database } from "../types"

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .alterTable("entities")
    .addColumn("integration_type", "integer")
    .addColumn("external_properties", "text")
    .execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema
    .alterTable("entities")
    .dropColumn("integration_type")
    .dropColumn("external_properties")
    .execute()
}
