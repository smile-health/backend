import type { Kysely } from "kysely"
import { addTimestampColumns } from "../helper.js"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .createTable(`mapping_entity_material_activities`)
    .addColumn("id", "bigint", (col) => col.autoIncrement().primaryKey())
    .addColumn("program_id", "bigint", (col) => col.notNull())
    .addColumn(`platform_entity_material_activity_id`, "bigint", (col) =>
      col.notNull()
    )
    .addColumn(`existing_entity_material_activity_id`, "bigint", (col) =>
      col.notNull()
    )
    .addColumn(`existing_entity_material_id`, "bigint", (col) => col.notNull())
    .$call(addTimestampColumns)
    .execute()

  await db.schema
    .createIndex(`idx_mapping_entity_material_activities_platform_ema_id`)
    .on(`mapping_entity_material_activities`)
    .column(`platform_entity_material_activity_id`)
    .execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.dropTable("mapping_entity_material_activities").execute()
}
