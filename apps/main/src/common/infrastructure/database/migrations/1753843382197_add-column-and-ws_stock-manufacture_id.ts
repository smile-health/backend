import { type Kysely } from "kysely"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .alterTable("ws_stocks")
    .addColumn("manufacture_id", "bigint")
    .execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.alterTable("ws_stocks").dropColumn("manufacture_id").execute()
}
