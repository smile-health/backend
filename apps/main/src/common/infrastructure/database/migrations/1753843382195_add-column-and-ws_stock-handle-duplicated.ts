import { type Kysely } from "kysely"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .alterTable("ws_stocks")
    .addColumn("batch_code", "varchar(255)")
    .execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.alterTable("ws_stocks").dropColumn("batch_code").execute()
}
