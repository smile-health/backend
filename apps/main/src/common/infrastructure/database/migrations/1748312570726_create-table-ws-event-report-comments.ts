import { sql, type Kysely } from "kysely"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .createTable("ws_event_report_comments")
    .addColumn("id", "bigint", (col) => col.primaryKey().autoIncrement())
    .addColumn("report_id", "bigint", (col) => col.notNull())
    .addColumn("comment", "varchar(255)", (col) => col.notNull())
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
  await db.schema.dropTable("ws_event_report_comments").execute()
}
