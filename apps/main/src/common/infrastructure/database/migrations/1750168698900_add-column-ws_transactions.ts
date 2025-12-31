import type { Kysely } from "kysely"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .alterTable("ws_transactions")
    .addColumn("companion_program_id", "bigint")
    .addColumn("companion_activity_id", "bigint")
    .execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema
    .alterTable("ws_transactions")
    .dropColumn("companion_program_id")
    .dropColumn("companion_activity_id")
    .execute()
}
