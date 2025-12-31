import type { Kysely } from "kysely"
import { addAuditColumns, addTimestampColumns } from "../helper.js"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .createTable("ws_microplan_targets_consumptions")
    .addColumn("id", "bigint", (col) => col.autoIncrement().primaryKey())
    .addColumn("target_id", "bigint", (col) => col.notNull())
    .addColumn("material_id", "bigint", (col) => col.notNull())
    .addColumn("material_target_id", "bigint", (col) => col.notNull())
    .addColumn("start_ideal_days", "integer")
    .addColumn("ideal_date", "date")
    .$call(addTimestampColumns)
    .$call(addAuditColumns)
    .execute()

  await db.schema
    .createIndex("ws_microplan_targets_consumptions_target_id_idx")
    .on("ws_microplan_targets_consumptions")
    .column("target_id")
    .execute()

  await db.schema
    .createIndex("ws_microplan_targets_consumptions_material_id_idx")
    .on("ws_microplan_targets_consumptions")
    .column("material_id")
    .execute()

  await db.schema
    .createIndex("ws_microplan_targets_consumptions_material_target_id_idx")
    .on("ws_microplan_targets_consumptions")
    .column("material_target_id")
    .execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.dropTable("ws_microplan_targets_consumptions").execute()
}
