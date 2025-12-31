import { Kysely, sql } from "kysely"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .createTable("export_histories")
    .addColumn("id", "integer", (col) => col.autoIncrement().primaryKey())
    .addColumn("original_filename", "varchar(255)", (col) => col.notNull())
    .addColumn("filename", "varchar(255)", (col) => col.notNull())
    .addColumn(
      "status",
      sql`enum('in_queue','in_progress','success','failed')`,
      (col) => col.defaultTo("in_queue").notNull()
    )
    .addColumn("expires_at", sql`timestamp NULL DEFAULT NULL`)
    .addColumn("created_at", "timestamp", (col) =>
      col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull()
    )
    .addColumn("updated_at", "timestamp", (col) =>
      col
        .defaultTo(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`)
        .notNull()
    )
    .addColumn("created_by", "integer", (col) => col.notNull())
    .execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.dropTable("export_histories").execute()
}
