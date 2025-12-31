import { Kysely, sql } from "kysely"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .createTable("locations")
    .addColumn("id", "bigint", (col) => col.primaryKey())
    .addColumn("parent_id", "bigint")
    .addColumn("name", "varchar(255)", (col) => col.notNull())
    .addColumn("lat", "varchar(255)")
    .addColumn("lng", "varchar(255)")
    .addColumn("level", "smallint", (col) => col.defaultTo(0))
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
  await db.schema.dropTable("locations").execute()
}
