import type { Kysely } from "kysely"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .alterTable("ws_village_estimation_details")
    .renameColumn("avalable_facillity_service", "available_facillity_service")
    .execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema
    .alterTable("ws_village_estimation_details")
    .renameColumn("available_facillity_service", "avalable_facillity_service")
    .execute()
}
