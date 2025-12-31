import type { Kysely } from "kysely"

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createIndex("idx_ws_stocks_composite")
    .on("ws_stocks")
    .columns(["entity_id", "activity_id", "material_id"])
    .execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropIndex("idx_ws_stocks_composite").execute()
}
