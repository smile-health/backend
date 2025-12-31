import { sql, type Kysely } from "kysely"
import { Database } from "../types/index.js"
export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .createTable("ws_event_report_reasons")
    .addColumn("id", "bigint", (col) => col.primaryKey().autoIncrement())
    .addColumn("parent_id", "bigint")
    .addColumn("title", "varchar(255)", (col) => col.notNull())
    .addColumn("description", "text")
    .addColumn("is_active", "boolean", (col) => col.notNull().defaultTo(true))
    .addColumn("program_id", "smallint", (col) => col.notNull())
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
  await db.schema.dropTable("ws_event_report_reasons").execute()
}
