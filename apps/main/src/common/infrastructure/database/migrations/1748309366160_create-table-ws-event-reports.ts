import { sql, type Kysely } from "kysely"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .createTable("ws_event_reports")
    .addColumn("id", "bigint", (col) => col.primaryKey().autoIncrement())
    .addColumn("entity_id", "bigint", (col) => col.notNull())
    .addColumn("has_order", "smallint", (col) => col.notNull().defaultTo(1))
    .addColumn("order_id", "bigint")
    .addColumn("do_number", "varchar(255)", (col) => col.defaultTo(null))
    .addColumn("arrived_date", "datetime", (col) => col.notNull())
    .addColumn("status_id", "smallint", (col) => col.notNull().defaultTo(1))
    .addColumn("program_id", "smallint", (col) => col.notNull())
    .addColumn("link", "varchar(255)")
    .addColumn("created_by", "bigint")
    .addColumn("updated_by", "bigint")
    .addColumn("deleted_by", "bigint")
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
  await db.schema.dropTable("ws_event_reports").execute()
}
