import { Kysely } from "kysely"
import { addAuditColumns, addTimestampColumns } from "../helper.js"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .createTable("ws_monthly_vaccine_need_details")
    .addColumn("id", "bigint", (col) => col.autoIncrement().primaryKey())
    .addColumn("material_need_id", "bigint", (col) => col.notNull())
    .addColumn("min_stock", "integer")
    .addColumn("max_stock", "integer")
    .addColumn("request_qty", "integer")
    .$call(addTimestampColumns)
    .$call(addAuditColumns)
    .execute()

  await db.schema
    .createIndex("monthly_vaccine_need_id_idx")
    .on("ws_monthly_vaccine_need_details")
    .column("material_need_id")
    .execute()

  await db.schema
    .createIndex("monthly_vaccine_deleted_at_idx")
    .on("ws_monthly_vaccine_need_details")
    .column("deleted_at")
    .execute()

  await db.schema
    .createIndex("monthly_vaccine_need_deleted_idx")
    .on("ws_monthly_vaccine_need_details")
    .columns(["material_need_id", "deleted_at"])
    .execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.dropTable("ws_monthly_vaccine_need_details").execute()
}
