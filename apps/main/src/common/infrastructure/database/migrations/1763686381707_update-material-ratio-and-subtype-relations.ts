import { Kysely, sql } from "kysely"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .alterTable("material_subtype_relations")
    .renameColumn("from_naterial_subtype_id", "from_material_subtype_id")
    .renameColumn("to_naterial_subtype_id", "to_material_subtype_id")
    .execute()

  await sql`
    ALTER TABLE ws_material_ratios
    MODIFY COLUMN from_material_id BIGINT NOT NULL,
    MODIFY COLUMN to_material_id BIGINT NOT NULL
  `.execute(db)
}

export async function down(db: Kysely<Database>): Promise<void> {
  await sql`
    ALTER TABLE ws_material_ratios
    MODIFY COLUMN from_material_id VARCHAR(100) NOT NULL,
    MODIFY COLUMN to_material_id VARCHAR(100) NOT NULL
  `.execute(db)

  await db.schema
    .alterTable("material_subtype_relations")
    .renameColumn("from_material_subtype_id", "from_naterial_subtype_id")
    .renameColumn("to_material_subtype_id", "to_naterial_subtype_id")
    .execute()
}
