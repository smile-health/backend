import type { Kysely } from "kysely"
import { sql } from "kysely"
import { Database } from "../types/index.js"
import { addAuditColumns, addTimestampColumns } from "../helper.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .createTable("material_workspaces")
    .addColumn("id", "bigint", (col) => col.autoIncrement().primaryKey())
    .addColumn("material_id", "bigint", (col) =>
      col.references("materials.id").onDelete("restrict").notNull()
    )
    .addColumn("workspace_id", "bigint", (col) =>
      col.references("workspaces.id").onDelete("restrict").notNull()
    )
    .addColumn("status", "boolean", (col) => col.defaultTo(true))
    .addColumn("is_open_vial", "boolean", (col) => col.defaultTo(false))
    .addColumn("is_addremove", "boolean", (col) => col.defaultTo(false))
    .$call(addAuditColumns)
    .$call(addTimestampColumns)
    .addUniqueConstraint("unique_constraint_material_id_workspace_id", [
      "material_id",
      "workspace_id",
    ])
    .execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.dropTable("material_workspaces").execute()
}
