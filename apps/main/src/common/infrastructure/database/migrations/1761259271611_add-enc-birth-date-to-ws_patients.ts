import type { Kysely } from "kysely"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .alterTable("ws_patients")
    .addColumn("enc_birth_date", "varchar(255)")
    .execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema
    .alterTable("ws_patients")
    .dropColumn("enc_birth_date")
    .execute()
}
