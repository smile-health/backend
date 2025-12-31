import type { Kysely } from "kysely"
import { Database } from "../types"

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .alterTable("material_relations")
    .renameColumn("from_material_id", "child_material_id")
    .execute()

  await db.schema
    .alterTable("material_relations")
    .renameColumn("to_material_id", "parent_material_id")
    .execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema
    .alterTable("material_relations")
    .renameColumn("child_material_id", "from_material_id")
    .execute()

  await db.schema
    .alterTable("material_relations")
    .renameColumn("parent_material_id", "to_material_id")
    .execute()
}
