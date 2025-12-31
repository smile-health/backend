import type { Kysely } from 'kysely';
import { DB } from '../types/db.js';

export async function up(db: Kysely<DB>): Promise<void> {
  await db.schema
    .alterTable("master_material_has_activities")
    .addColumn("is_sequence", 'boolean')
    .execute()
}

export async function down(db: Kysely<DB>): Promise<void> {
  await db.schema
    .alterTable("master_material_has_activities")
    .dropColumn("is_sequence")
    .execute()
}
