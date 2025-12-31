import type { Kysely } from "kysely"

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable("mapping_assets")
    .addColumn("existing_source_type", "varchar(255)")
    .execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable("mapping_assets")
    .dropColumn("existing_source_type")
    .execute()
}
