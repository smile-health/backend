import type { Kysely } from "kysely"
import { Database } from "../types"

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .alterTable("entity_tags")
    .addColumn("integration_type", "integer")
    .addColumn("external_properties", "text")
    .execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema
    .alterTable("entity_tags")
    .dropColumn("integration_type")
    .dropColumn("external_properties")
    .execute()
}
