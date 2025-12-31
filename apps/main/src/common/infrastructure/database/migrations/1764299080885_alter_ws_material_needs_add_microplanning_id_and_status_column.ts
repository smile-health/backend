import type { Kysely } from "kysely"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .alterTable("ws_material_needs")
    .addColumn("microplanning_id", "bigint", (col) => col.notNull())
    .addColumn("status", "int2", (col) => col.defaultTo(0))
    .execute()

  await db.schema
    .alterTable("ws_material_needs")
    .addForeignKeyConstraint(
      "ws_material_needs_microplanning_id_fk",
      ["microplanning_id"],
      "ws_microplanning",
      ["id"]
    )
    .onDelete("cascade")
    .execute()

  await db.schema
    .createIndex("ws_material_needs_microplanning_id_idx")
    .on("ws_material_needs")
    .column("microplanning_id")
    .execute()

  await db.schema
    .createIndex("ws_material_needs_status_idx")
    .on("ws_material_needs")
    .column("status")
    .execute()

  await db.schema
    .alterTable("ws_material_needs")
    .dropColumn("year")
    .execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema
    .alterTable("ws_material_needs")
    .addColumn("year", "int4")
    .execute()

  await db.schema
    .alterTable("ws_material_needs")
    .dropConstraint("ws_material_needs_microplanning_id_fk")
    .execute()

  await db.schema
    .alterTable("ws_material_needs")
    .dropColumn("microplanning_id")
    .dropColumn("status")
    .execute()
}
