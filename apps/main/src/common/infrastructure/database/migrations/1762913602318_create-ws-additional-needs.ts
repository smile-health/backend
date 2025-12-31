import { Kysely } from "kysely"
import { addAuditColumns, addTimestampColumns } from "../helper.js"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .createTable("ws_additional_needs")
    .addColumn("id", "bigint", (col) => col.autoIncrement().primaryKey())
    .addColumn("material_need_id", "bigint", (col) => col.notNull())
    .addColumn("material_target_id", "bigint", (col) => col.notNull())
    .addColumn("remaining_stock", "integer")
    .addColumn("total", "integer")
    .$call(addTimestampColumns)
    .$call(addAuditColumns)
    .execute()

  await db.schema
    .createIndex("additional_need_need_id_idx")
    .on("ws_additional_needs")
    .column("material_need_id")
    .execute()

  await db.schema
    .createIndex("additional_need_target_id_idx")
    .on("ws_additional_needs")
    .column("material_target_id")
    .execute()

  await db.schema
    .createIndex("additional_need_deleted_at_idx")
    .on("ws_additional_needs")
    .column("deleted_at")
    .execute()

  await db.schema
    .createIndex("additional_need_need_deleted_idx")
    .on("ws_additional_needs")
    .columns(["material_need_id", "deleted_at"])
    .execute()

  await db.schema
    .createIndex("additional_need_target_deleted_idx")
    .on("ws_additional_needs")
    .columns(["material_target_id", "deleted_at"])
    .execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.dropTable("ws_additional_needs").execute()
}
