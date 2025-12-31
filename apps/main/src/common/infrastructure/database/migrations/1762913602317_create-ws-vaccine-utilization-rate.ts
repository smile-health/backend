import { Kysely } from "kysely"
import { addAuditColumns, addTimestampColumns } from "../helper.js"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .createTable("ws_vaccine_utilization_rate")
    .addColumn("id", "bigint", (col) => col.autoIncrement().primaryKey())
    .addColumn("material_need_id", "bigint", (col) => col.notNull())
    .addColumn("vaccine_utilization_rate", "double precision")
    .$call(addTimestampColumns)
    .$call(addAuditColumns)
    .execute()

  await db.schema
    .createIndex("vaccine_util_need_id_idx")
    .on("ws_vaccine_utilization_rate")
    .column("material_need_id")
    .execute()

  await db.schema
    .createIndex("vaccine_util_deleted_at_idx")
    .on("ws_vaccine_utilization_rate")
    .column("deleted_at")
    .execute()

  await db.schema
    .createIndex("vaccine_util_need_deleted_idx")
    .on("ws_vaccine_utilization_rate")
    .columns(["material_need_id", "deleted_at"])
    .execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.dropTable("ws_vaccine_utilization_rate").execute()
}
