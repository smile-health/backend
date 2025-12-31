import type { Kysely } from "kysely"
import { sql } from "kysely"
import { Database } from "../types/index.js"

export async function seed(db: Kysely<Database>): Promise<void> {
  await db.schema
    .createView("ws_transaction_lists")
    .orReplace()
    .as(
      db
        .selectFrom("ws_transactions as wt")
        .leftJoin("ws_entities as we", "wt.entity_id", "we.id")
        .leftJoin(
          "ws_entities as we_companion",
          "wt.companion_entity_id",
          "we_companion.id"
        )
        .leftJoin(
          "workspaces as w_program",
          "wt.companion_program_id",
          "w_program.id"
        )
        .leftJoin(
          "ws_activities as wa_companion",
          "wt.companion_activity_id",
          "wa_companion.id"
        )
        .leftJoin("locations as l_province", "we.province_id", "l_province.id")
        .leftJoin("locations as l_regency", "we.regency_id", "l_regency.id")
        .leftJoin("ws_stocks as ws", "wt.stock_id", "ws.id")
        .leftJoin("ws_materials as wm", "ws.material_id", "wm.id")
        .leftJoin("ws_materials as wmp", "wm.parent_id", "wmp.id")
        .leftJoin("material_types as mt", "wm.material_type_id", "mt.id")
        .leftJoin("ws_activities as wa", "wt.activity_id", "wa.id")
        .leftJoin(
          "ws_transaction_types as wtt",
          "wt.transaction_type_id",
          "wtt.id"
        )
        .leftJoin(
          "ws_transaction_reasons as wtr",
          "wt.transaction_reason_id",
          "wtr.id"
        )
        .leftJoin("ws_other_reasons as wor", (join) =>
          join
            .onRef("wt.id", "=", "wor.source_id")
            .on("wor.source_type", "=", "transaction")
        )
        .leftJoin("ws_orders as wo", "wt.order_id", "wo.id")
        .leftJoin("ws_order_statuses as wos", "wo.order_status_id", "wos.id")
        .leftJoin("ws_order_types as wot", "wo.order_type_id", "wot.id")
        .leftJoin(
          "ws_entities as wo_customer",
          "wo.customer_id",
          "wo_customer.id"
        )
        .leftJoin("ws_entities as wo_vendor", "wo.vendor_id", "wo_vendor.id")
        .leftJoin("ws_users as u_created", "wt.created_by", "u_created.id")
        .leftJoin("ws_users as u_updated", "wt.updated_by", "u_updated.id")
        .leftJoin("ws_purchases as wpc", (join) =>
          join
            .onRef("wt.id", "=", "wpc.source_id")
            .on("wpc.source_type", "=", "transaction")
        )
        .leftJoin("ws_budget_sources as wbs", "wpc.budget_source_id", "wbs.id")
        .leftJoin("ws_activities as was", "ws.activity_id", "was.id")
        .leftJoin("ws_batches as wb", "ws.batch_id", "wb.id")
        .leftJoin("ws_manufactures as wmf", "wb.manufacture_id", "wmf.id")
        .select([
          "wt.id as transaction_id",
          "wt.deleted_at as deleted_at",
          "we.id as entity_id",
          "we.name as entity_name",
          "we.entity_tag_id as entity_tag_id",
          "l_province.id as province_id",
          "l_province.name as province_name",
          "l_regency.id as regency_id",
          "l_regency.name as regency_name",
          "we_companion.id as companion_entity_id",
          "we_companion.name as companion_entity_name",
          "w_program.id as companion_program_id",
          "w_program.name as companion_program_name",
          "wa_companion.id as companion_activity_id",
          "wa_companion.name as companion_activity_name",
          "wmp.id as parent_material_id",
          "wmp.name as parent_material_name",
          "wm.id as material_id",
          "wm.name as material_name",
          "wm.description as material_description",
          "wm.is_open_vial as material_is_open_vial",
          "wm.is_managed_in_batch as material_is_managed_in_batch",
          "mt.id as material_type_id",
          "mt.name as material_type_name",
          "wa.id as activity_id",
          "wa.name as activity_name",
          "wa.program_id as program_id",
          "wtt.id as transaction_type_id",
          "wtt.title as transaction_type_title",
          "wtt.change_type as transaction_change_type",
          "wtr.id as transaction_reason_id",
          "wtr.title as transaction_reason_title",
          "wtr.is_other as transaction_reason_is_other",
          "wtr.is_purchase as transaction_reason_is_purchase",
          "wor.content as other_reason",
          "wo.id as order_id",
          "wo.order_status_id as order_status",
          "wos.name as order_status_label",
          "wo.order_type_id as order_type",
          "wot.name as order_type_label",
          "wo_vendor.id as vendor_id",
          "wo_vendor.name as vendor_name",
          "wo_customer.id as customer_id",
          "wo_customer.name as customer_name",
          "wo_customer.entity_tag_id as customer_entity_tag_id",
          "wt.opening_qty as opening_qty",
          "wt.change_qty as change_qty",
          sql<number>`wt.opening_qty + wt.change_qty`.as("closing_qty"),
          "wt.device_type as device_type",
          "wt.actual_transaction_date as actual_transaction_date",
          "wt.created_at as created_at",
          "wt.updated_at as updated_at",
          "u_created.id as created_by_id",
          "u_created.username as created_by_username",
          "u_created.firstname as created_by_firstname",
          "u_created.lastname as created_by_lastname",
          "u_updated.id as updated_by_id",
          "u_updated.username as updated_by_username",
          "u_updated.firstname as updated_by_firstname",
          "u_updated.lastname as updated_by_lastname",
          "wpc.id as purchase_id",
          "wpc.year as purchase_year",
          "wpc.price as purchase_price",
          "wbs.id as budget_source_id",
          "wbs.name as budget_source_name",
          "ws.id as stock_id",
          "ws.open_vial_qty as stock_open_vial",
          "ws.qty as stock_close_vial",
          "ws.allocated_qty as stock_allocated_qty",
          "was.id as stock_activity_id",
          "was.name as stock_activity_name",
          "wb.id as batch_id",
          "wb.code as batch_code",
          "wb.expired_date as batch_expired_date",
          "wb.production_date as batch_production_date",
          "wb.status as batch_status",
          "wmf.id as manufacture_id",
          "wmf.name as manufacture_name",
          "wmf.address as manufacture_address",
          "wt.change_qty_open_vial as change_qty_open_vial",
          "we_companion.is_open_vial as entity_is_open_vial",
          "wt.opening_qty_open_vial as opening_qty_open_vial",
          sql<number>`wt.opening_qty_open_vial + wt.change_qty_open_vial`.as(
            "closing_qty_open_vial"
          ),
          sql<number>`case when exists(select 1 from ws_consumptions as wc where wc.transaction_id = wt.id and wc.patient_id is not null limit 1) then 1 else 0 end`.as(
            "patient_data"
          ),
        ])
    )
    .execute()
}
