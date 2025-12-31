import { Kysely, sql } from "kysely"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .createTable("roles_to_resource_mapping")
    .addColumn("id", "bigint", (col) => col.autoIncrement().primaryKey())
    .addColumn("http_method", "varchar(10)")
    .addColumn("route_handler", "varchar(255)", (col) => col.notNull())
    .addColumn("role_list", "text")
    .addColumn("resource_type", sql`enum('fe', 'be')`, (col) =>
      col.notNull().defaultTo("be")
    )
    .addColumn("status", "smallint", (col) => col.notNull().defaultTo(1))
    .addColumn("created_at", "timestamp", (col) =>
      col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull()
    )
    .addColumn("updated_at", "timestamp", (col) =>
      col
        .defaultTo(sql`CURRENT_TIMESTAMP `)
        .notNull()
        .modifyEnd(sql`ON UPDATE CURRENT_TIMESTAMP`)
    )
    .addColumn("created_by", "varchar(50)", (col) => col.notNull())
    .addColumn("updated_by", "varchar(50)")
    .execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.dropTable("roles_to_resource_mapping").execute()
}
