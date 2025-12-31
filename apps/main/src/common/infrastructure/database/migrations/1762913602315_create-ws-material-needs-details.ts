import { Kysely } from "kysely"
import { addAuditColumns, addTimestampColumns } from "../helper.js"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .createTable("ws_material_needs_details")
    .addColumn("id", "bigint", (col) => col.autoIncrement().primaryKey())
    .addColumn("material_need_id", "bigint", (col) => col.notNull())
    .addColumn("absolute_number_of_routine_immunization", "integer")
    .addColumn("number_of_vials_used", "integer")
    .addColumn("remaining_stock", "integer")
    .$call(addTimestampColumns)
    .$call(addAuditColumns)
    .execute()

  await db.schema
    .createIndex("material_need_detail_need_id_idx")
    .on("ws_material_needs_details")
    .column("material_need_id")
    .execute()

  await db.schema
    .createIndex("material_need_detail_deleted_at_idx")
    .on("ws_material_needs_details")
    .column("deleted_at")
    .execute()

  await db.schema
    .createIndex("material_need_detail_need_deleted_idx")
    .on("ws_material_needs_details")
    .columns(["material_need_id", "deleted_at"])
    .execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.dropTable("ws_material_needs_details").execute()
}
