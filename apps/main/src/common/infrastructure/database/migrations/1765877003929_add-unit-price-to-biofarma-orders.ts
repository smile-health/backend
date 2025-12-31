import type { Kysely } from "kysely"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .alterTable("integration_biofarma_orders")
    .addColumn("unit_price", "double precision")
    .execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema
    .alterTable("integration_biofarma_orders")
    .dropColumn("unit_price")
    .execute()
}
