import { Kysely, sql } from "kysely"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .createTable("user_changelogs")
    .addColumn("id", "bigint", (col) => col.autoIncrement().primaryKey())
    .addColumn("user_id", "bigint", (col) => col.notNull())
    .addColumn("field", "varchar(255)", (col) => col.notNull())
    .addColumn("old_value", "varchar(255)")
    .addColumn("new_value", "varchar(255)")
    .addColumn("created_at", "timestamp", (col) =>
      col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull()
    )
    .addColumn("updated_at", "timestamp", (col) =>
      col
        .defaultTo(sql`CURRENT_TIMESTAMP `)
        .notNull()
        .modifyEnd(sql`ON UPDATE CURRENT_TIMESTAMP`)
    )
    .addColumn("updated_by", "bigint")
    .execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.dropTable("user_changelogs").execute()
}
