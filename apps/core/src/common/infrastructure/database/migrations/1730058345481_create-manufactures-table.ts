import { Kysely, sql } from "kysely"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .createTable("manufactures")
    .addColumn("id", "bigint", (col) => col.autoIncrement().primaryKey())
    .addColumn("name", "varchar(255)", (col) => col.notNull())
    .addColumn("type", "integer", (col) => col.notNull())
    .addColumn("reference_id", "varchar(255)")
    .addColumn("description", "varchar(255)")
    .addColumn("contact_name", "varchar(255)")
    .addColumn("phone_number", "varchar(20)")
    .addColumn("email", "varchar(255)")
    .addColumn("address", "varchar(255)")
    .addColumn("status", "integer")
    .addColumn("created_by", "bigint")
    .addColumn("updated_by", "bigint")
    .addColumn("created_at", "timestamp", (col) =>
      col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull()
    )
    .addColumn("updated_at", "timestamp", (col) =>
      col
        .defaultTo(sql`CURRENT_TIMESTAMP `)
        .notNull()
        .modifyEnd(sql`ON UPDATE CURRENT_TIMESTAMP`)
    )
    .execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.dropTable("manufactures").execute()
}
