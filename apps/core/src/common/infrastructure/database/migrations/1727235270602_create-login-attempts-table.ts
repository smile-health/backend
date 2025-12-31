import { Kysely, sql } from "kysely"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .createTable("login_attempts")
    .addColumn("id", "bigint", (col) => col.autoIncrement().primaryKey())
    .addColumn("ip", "varchar(255)")
    .addColumn("hit", "smallint")
    .addColumn("last_attempt", "timestamp")
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
  await db.schema.dropTable("login_attempts").execute()
}
