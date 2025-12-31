import type { Kysely } from 'kysely'
import { DB } from '../types/db.js';

const tables = [
  "users",
  "entities",
  "master_materials",
  "manufactures",
]

export async function up(db: Kysely<DB>): Promise<void> {
  for (const table of tables) {
    await db.schema
      .alterTable(table)
      .addColumn("global_id", "bigint")
      .execute()
  }
}

export async function down(db: Kysely<DB>): Promise<void> {
  for (const table of tables) {
    await db.schema
      .alterTable(table)
      .dropColumn("global_id")
      .execute()
  }
}
