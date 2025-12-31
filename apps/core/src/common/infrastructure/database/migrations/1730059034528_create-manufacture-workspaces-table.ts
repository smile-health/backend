import { Kysely, sql } from "kysely"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .createTable("manufacture_workspaces")
    .addColumn("id", "bigint", (col) => col.autoIncrement().primaryKey())
    .addColumn("manufacture_id", "bigint", (col) => col.notNull())
    .addColumn("workspace_id", "bigint", (col) => col.notNull())
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
    .addColumn("status", "smallint")
    .execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.dropTable("manufacture_workspaces").execute()
}
