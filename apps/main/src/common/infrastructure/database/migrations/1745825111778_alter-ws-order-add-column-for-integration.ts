import { Kysely } from "kysely"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .alterTable("ws_orders")
    .addColumn("validated_by", "bigint")
    .addColumn("validated_at", "datetime")
    .execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema
    .alterTable("ws_orders")
    .dropColumn("validated_by")
    .dropColumn("validated_at")
    .execute()
}
