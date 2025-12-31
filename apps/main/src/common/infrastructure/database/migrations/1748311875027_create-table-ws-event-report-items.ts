import { sql, type Kysely } from "kysely"
import { Database } from "../types/index.js"
export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .createTable("ws_event_report_items")
    .addColumn("id", "bigint", (col) => col.primaryKey().autoIncrement())
    .addColumn("report_id", "bigint", (col) => col.notNull())
    .addColumn("material_id", "bigint")
    .addColumn("custom_material", "varchar(255)")
    .addColumn("no_batch", "varchar(255)")
    .addColumn("expired_date", "datetime")
    .addColumn("production_date", "datetime")
    .addColumn("qty", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("reason_id", "smallint", (col) => col.defaultTo(null))
    .addColumn("child_reason_id", "smallint", (col) => col.defaultTo(null))
    .addColumn("created_by", "bigint", (col) => col.notNull())
    .addColumn("created_at", "datetime", (col) =>
      col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`)
    )
    .addColumn("updated_at", "datetime", (col) =>
      col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`)
    )
    .addColumn("deleted_at", "datetime")
    .execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.dropTable("ws_event_report_items").execute()
}
