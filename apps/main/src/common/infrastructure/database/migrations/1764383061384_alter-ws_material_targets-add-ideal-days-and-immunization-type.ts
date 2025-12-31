import { Kysely, sql } from "kysely"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .alterTable("ws_material_targets")
    .addColumn("start_ideal_days", "bigint")
    .execute()

  await db.schema
    .alterTable("ws_material_targets")
    .addColumn("end_ideal_days", "bigint")
    .execute()

  await db.schema
    .alterTable("ws_material_targets")
    .addColumn("restricted_ideal_day", "bigint")
    .execute()

  await db.schema
    .alterTable("ws_material_targets")
    .addColumn("parent_id", "bigint")
    .execute()

  await sql`
    ALTER TABLE ws_material_targets
    MODIFY COLUMN type ENUM('primary','additional','immunization') NOT NULL
  `.execute(db)
}

export async function down(db: Kysely<Database>): Promise<void> {
  await sql`
    ALTER TABLE ws_material_targets
    MODIFY COLUMN type ENUM('primary','additional') NOT NULL
  `.execute(db)

  await db.schema
    .alterTable("ws_material_targets")
    .dropColumn("restricted_ideal_day")
    .execute()

  await db.schema
    .alterTable("ws_material_targets")
    .dropColumn("end_ideal_days")
    .execute()

  await db.schema
    .alterTable("ws_material_targets")
    .dropColumn("start_ideal_days")
    .execute()

  await db.schema
    .alterTable("ws_material_targets")
    .dropColumn("parent_id")
    .execute()
}
