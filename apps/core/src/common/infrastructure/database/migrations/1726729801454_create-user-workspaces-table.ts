import { Kysely, sql } from "kysely"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .createTable("user_workspaces")
    .addColumn("id", "bigint", (col) => col.autoIncrement().primaryKey())
    .addColumn("user_id", "bigint", (col) => col.notNull())
    .addColumn("workspace_id", "integer", (col) => col.notNull())
    .addColumn("status", "boolean", (col) => col.defaultTo(true))
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
  await db.schema.dropTable("user_workspaces").execute()
}
