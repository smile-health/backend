import type { Kysely } from "kysely"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .alterTable("ws_targets")
    .addColumn("microplanning_id", "bigint", (col) => col.notNull())
    .addColumn("status", "int2", (col) => col.defaultTo(0))
    .execute()

  await db.schema
    .createIndex("ws_targets_microplanning_id_idx")
    .on("ws_targets")
    .column("microplanning_id")
    .execute()

  await db.schema
    .createIndex("ws_targets_status_idx")
    .on("ws_targets")
    .column("status")
    .execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema
    .alterTable("ws_targets")
    .dropColumn("microplanning_id")
    .dropColumn("status")
    .execute()
}
