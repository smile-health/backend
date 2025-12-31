/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Kysely } from "kysely"

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable("entities")
    .addColumn("parent_id", "bigint")
    .execute()
  await db.schema
    .createIndex("entities_parent_id_idx")
    .on("entities")
    .column("parent_id")
    .execute()
  await db.schema
    .createIndex("entities_code_idx")
    .on("entities")
    .column("code")
    .execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropIndex("entities_code_idx").on("entities").execute()
  await db.schema.dropIndex("entities_parent_id_idx").on("entities").execute()
  await db.schema.alterTable("entities").dropColumn("parent_id").execute()
}
