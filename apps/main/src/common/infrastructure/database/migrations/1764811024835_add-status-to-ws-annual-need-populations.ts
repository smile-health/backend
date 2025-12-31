import { Kysely, sql } from "kysely"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  const result = await sql<{ column_exists: number }>`
    SELECT COUNT(*) as column_exists
    FROM information_schema.columns
    WHERE table_schema = database()
    AND table_name = 'ws_annual_need_populations'
    AND column_name = 'status'
  `.execute(db)

  const columnExists = (result.rows[0]?.column_exists ?? 0) > 0

  if (!columnExists) {
    await db.schema
      .alterTable("ws_annual_need_populations")
      .addColumn("status", "varchar(50)", (col) => col.defaultTo(null))
      .execute()
  }
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema
    .alterTable("ws_annual_need_populations")
    .dropColumn("status")
    .execute()
}
