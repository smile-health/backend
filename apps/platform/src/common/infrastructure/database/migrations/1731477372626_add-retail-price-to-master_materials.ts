import type { Kysely } from 'kysely';
import { DB } from '../types/db.js';

export async function up(db: Kysely<DB>): Promise<void> {
  await db.schema
    .alterTable("master_materials")
    .addColumn("min_retail_price", "double precision", (col) => col.defaultTo(0))
    .addColumn("max_retail_price", "double precision", (col) => col.defaultTo(0))
    .execute()
}

export async function down(db: Kysely<DB>): Promise<void> {
  await db.schema
    .alterTable("master_materials")
    .dropColumn("min_retail_price")
    .dropColumn("max_retail_price")
    .execute()
}
