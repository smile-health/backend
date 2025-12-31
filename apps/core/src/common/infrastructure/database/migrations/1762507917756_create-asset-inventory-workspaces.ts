import type { Kysely } from "kysely"
import { addAuditColumns, addTimestampColumns } from "../helper.js"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .createTable("asset_inventory_workspaces")
    .ifNotExists()
    .addColumn("id", "bigint", (col) => col.autoIncrement().primaryKey())
    .addColumn("asset_inventory_id", "bigint", (col) => col.notNull())
    .addColumn("workspace_id", "bigint", (col) => col.notNull())
    .addColumn("status", "boolean", (col) => col.defaultTo(true))
    .$call(addAuditColumns)
    .$call(addTimestampColumns)
    .addUniqueConstraint("unique_constraint_asset_inventory_id_workspace_id", [
      "asset_inventory_id",
      "workspace_id",
    ])
    .execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.dropTable("asset_inventory_workspaces").ifExists().execute()
}
