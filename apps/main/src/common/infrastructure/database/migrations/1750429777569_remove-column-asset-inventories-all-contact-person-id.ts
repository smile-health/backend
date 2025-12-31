import type { Kysely } from "kysely"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .alterTable("ws_asset_inventories")
    .dropColumn("contact_person_user_1_id")
    .dropColumn("contact_person_user_2_id")
    .dropColumn("contact_person_user_3_id")
    .execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema
    .alterTable("ws_asset_inventories")
    .addColumn("contact_person_user_1_id", "bigint", (col) => col.notNull())
    .addColumn("contact_person_user_2_id", "bigint")
    .addColumn("contact_person_user_3_id", "bigint")
    .execute()
}
