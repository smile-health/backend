import type { Kysely } from "kysely"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .alterTable("materials")
    .addColumn("is_stock_opname_mandatory", "smallint", (col) => col.notNull().defaultTo(0))
    .execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema
    .alterTable("materials")
    .dropColumn("is_stock_opname_mandatory")
    .execute()
}
