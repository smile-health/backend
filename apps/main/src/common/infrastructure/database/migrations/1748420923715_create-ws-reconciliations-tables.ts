import { Kysely } from "kysely"
import { addTimestampColumns } from "../helper.js"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  // ws_reconciliations
  await db.schema
    .createTable("ws_reconciliations")
    .addColumn("id", "bigint", (col) => col.primaryKey().autoIncrement())
    .addColumn("program_id", "integer", (col) => col.notNull())
    .addColumn("material_id", "integer", (col) => col.notNull())
    .addColumn("entity_id", "integer", (col) => col.notNull())
    .addColumn("activity_id", "integer", (col) => col.notNull())
    .addColumn("start_date", "datetime", (col) => col.notNull())
    .addColumn("end_date", "datetime", (col) => col.notNull())
    .addColumn("created_by", "bigint")
    .addColumn("updated_by", "bigint")
    .addColumn("deleted_by", "bigint")
    .$call(addTimestampColumns)
    .execute()

  // ws_reconciliation_items
  await db.schema
    .createTable("ws_reconciliation_items")
    .addColumn("id", "bigint", (col) => col.primaryKey().autoIncrement())
    .addColumn("reconciliation_id", "bigint", (col) => col.notNull())
    .addColumn("reconciliation_category_id", "bigint", (col) => col.notNull())
    .addColumn("recorded_qty", "integer", (col) => col.defaultTo(0))
    .addColumn("actual_qty", "integer", (col) => col.defaultTo(0))
    .addColumn("created_by", "bigint")
    .addColumn("updated_by", "bigint")
    .addColumn("deleted_by", "bigint")
    .$call(addTimestampColumns)
    .addForeignKeyConstraint(
      "fk_ws_reconciliation_items_reconciliation_id",
      ["reconciliation_id"],
      "ws_reconciliations",
      ["id"]
    )
    .addForeignKeyConstraint(
      "fk_ws_reconciliation_items_category_id",
      ["reconciliation_category_id"],
      "reconciliation_categories",
      ["id"]
    )
    .execute()

  // ws_reconciliation_item_reason_actions
  await db.schema
    .createTable("ws_reconciliation_item_reason_actions")
    .addColumn("id", "bigint", (col) => col.primaryKey().autoIncrement())
    .addColumn("reconciliation_item_id", "bigint")
    .addColumn("reason_id", "bigint")
    .addColumn("action_id", "bigint")
    .$call(addTimestampColumns)
    .addForeignKeyConstraint(
      "fk_ws_recon_item_reason_actions_item_id",
      ["reconciliation_item_id"],
      "ws_reconciliation_items",
      ["id"]
    )
    .addForeignKeyConstraint(
      "fk_ws_recon_item_reason_actions_reason_id",
      ["reason_id"],
      "reconciliation_reasons",
      ["id"]
    )
    .addForeignKeyConstraint(
      "fk_ws_recon_item_reason_actions_action_id",
      ["action_id"],
      "reconciliation_actions",
      ["id"]
    )
    .execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.dropTable("ws_reconciliation_item_reason_actions").execute()
  await db.schema.dropTable("ws_reconciliation_items").execute()
  await db.schema.dropTable("ws_reconciliations").execute()
}
