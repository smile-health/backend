import type { Kysely } from "kysely"
import { Database } from "../types/index.js"
import { addAuditColumns, addTimestampColumns } from "../helper.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .createTable("ws_microplanning")
    .addColumn("id", "bigint", (col) => col.autoIncrement().primaryKey())
    .addColumn("entity_id", "bigint", (col) => col.notNull())
    .addColumn("year", "integer")
    .addColumn("status", "int2", (col) => col.defaultTo(0))
    .$call(addTimestampColumns)
    .$call(addAuditColumns)
    .execute()

  await db.schema
    .createIndex("ws_microplanning_entity_id_idx")
    .on("ws_microplanning")
    .column("entity_id")
    .execute()

  await db.schema
    .createIndex("ws_microplanning_year_idx")
    .on("ws_microplanning")
    .column("year")
    .execute()

  await db.schema
    .createIndex("ws_microplanning_status_idx")
    .on("ws_microplanning")
    .column("status")
    .execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.dropTable("ws_microplanning")
}
