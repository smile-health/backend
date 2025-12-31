import { Kysely } from "kysely"
import { Database } from "../types/index.js"

const mapTableIndexes = {
  ws_activities: {
    program_id: ["program_id"],
  },
  ws_disposal_stocks: {
    stock_id: ["stock_id"],
  },
  ws_disposal_shipments: {
    activity_id: ["activity_id"],
  },
  ws_disposal_shipment_items: {
    disposal_shipment_id: ["disposal_shipment_id"],
  },
  ws_disposal_shipment_stocks: {
    disposal_shipment_item_id: ["disposal_shipment_item_id"],
  },
  ws_disposal_shipment_comments: {
    disposal_shipment_id: ["disposal_shipment_id"],
  },
  ws_disposal_transactions: {
    activity_id: ["activity_id"],
  },
  ws_purchases: {
    source_id_source_type: ["source_id", "source_type"],
  },
  entity_workspaces: {
    workspace_id: ["workspace_id"],
  },
  ws_event_reports: {
    program_id: ["program_id"],
  },
  ws_event_report_comments: {
    report_id: ["report_id"],
  },
  ws_event_report_items: {
    report_id: ["report_id"],
  },
  ws_event_report_histories: {
    report_id: ["report_id"],
  },
  ws_material_activities: {
    material_id: ["material_id"],
  },
  ws_material_companions: {
    material_id: ["material_id"],
  },
  ws_material_permissions: {
    material_id: ["material_id"],
  },
  ws_material_manufactures: {
    material_id: ["material_id"],
  },
  ws_reconciliations: {
    activity_id: ["activity_id"],
  },
  ws_reconciliation_items: {
    reconciliation_id: ["reconciliation_id"],
  },
  ws_reconciliation_item_reason_actions: {
    reconciliation_item_id: ["reconciliation_item_id"],
  },
  ws_other_reasons: {
    source_type_source_id: ["source_type", "source_id"],
  },
  entity_prep_min_max: {
    program_id: ["program_id"],
  },
  ws_asset_inventories: {
    program_id: ["program_id"],
  },
}

export async function up(db: Kysely<Database>): Promise<void> {
  Object.keys(mapTableIndexes).forEach(async (table) => {
    Object.keys(mapTableIndexes[table]).forEach(async (index) => {
      await db.schema
        .createIndex(`${table}_${index}`)
        .on(table)
        .columns(mapTableIndexes[table][index])
        .execute()
    })
  })
}

export async function down(db: Kysely<Database>): Promise<void> {
  Object.keys(mapTableIndexes).forEach(async (table) => {
    Object.keys(mapTableIndexes[table]).forEach(async (index) => {
      await db.schema.dropIndex(`${table}_${index}`).on(table).execute()
    })
  })
}
