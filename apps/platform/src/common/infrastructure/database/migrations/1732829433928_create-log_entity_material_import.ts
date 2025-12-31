import { Kysely, sql } from "kysely"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .createTable("log_entity_material_imports")
    .addColumn("id", "bigint", (col) => col.autoIncrement().primaryKey())
    .addColumn("file", "varchar(255)", (col) => col.notNull())
    .addColumn("status", "smallint", (col) => col.notNull()) // Status dengan nilai terbatas
    .addColumn("notes", sql`mediumtext`, (col) => col.notNull()) // Errors sebagai array
    .addColumn("created_at", "timestamp", (col) =>
      col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull()
    )
    .addColumn("created_by", "bigint")
    .addColumn("updated_at", "timestamp", (col) =>
      col
        .defaultTo(sql`CURRENT_TIMESTAMP `)
        .notNull()
        .modifyEnd(sql`ON UPDATE CURRENT_TIMESTAMP`)
    )
    .addColumn("updated_by", "bigint")
    .addColumn("deleted_at", "timestamp")
    .addColumn("deleted_by", "bigint")
    .execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.dropTable("log_entity_material_imports").execute()
}
