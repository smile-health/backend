import type { Kysely } from "kysely"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .alterTable("ws_reconciliation_item_reason_actions")
    .dropConstraint("fk_ws_recon_item_reason_actions_reason_id")
    .execute()

  await db.schema
    .alterTable("ws_reconciliation_item_reason_actions")
    .dropIndex("fk_ws_recon_item_reason_actions_reason_id")
    .execute()

  await db.schema
    .alterTable("ws_reconciliation_item_reason_actions")
    .dropConstraint("fk_ws_recon_item_reason_actions_action_id")
    .execute()

  await db.schema
    .alterTable("ws_reconciliation_item_reason_actions")
    .dropIndex("fk_ws_recon_item_reason_actions_action_id")
    .execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema
    .alterTable("ws_reconciliation_item_reason_actions")
    .addForeignKeyConstraint(
      "fk_ws_recon_item_reason_actions_reason_id",
      ["reason_id"],
      "reconciliation_reasons",
      ["id"]
    )
    .execute()

  await db.schema
    .alterTable("ws_reconciliation_item_reason_actions")
    .addForeignKeyConstraint(
      "fk_ws_recon_item_reason_actions_action_id",
      ["action_id"],
      "reconciliation_actions",
      ["id"]
    )
    .execute()
}
