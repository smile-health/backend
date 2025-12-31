import type { Kysely } from "kysely"

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable("mapping_activities")
    .addColumn("existing_program_id", "integer")
    .execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable("mapping_activities")
    .dropColumn("existing_program_id")
    .execute()
}
