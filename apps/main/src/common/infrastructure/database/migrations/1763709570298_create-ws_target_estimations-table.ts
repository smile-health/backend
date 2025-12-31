import type { Kysely } from "kysely"
import { addAuditColumns, addTimestampColumns } from "../helper.js"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .createTable("ws_target_estimations")
    .addColumn("id", "bigint", (col) => col.autoIncrement().primaryKey())
    .addColumn("entity_id", "bigint", (col) => col.notNull())
    .addColumn("notes", "text", (col) => col.defaultTo(""))
    .$call(addTimestampColumns)
    .$call(addAuditColumns)
    .execute()

  await db.schema
    .createIndex("ws_target_estimations_entity_id_idx")
    .on("ws_target_estimations")
    .column("entity_id")
    .execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.dropTable("ws_target_estimations")
}
