import type { Kysely } from "kysely"
import { sql } from "kysely"
import { Database } from "../types/index.js"

export async function seed(db: Kysely<Database>): Promise<void> {
  await db.schema
    .createView("ws_order_lists")
    .orReplace()
    .as(
      db
        .selectFrom("ws_orders as wso")
        .innerJoin("ws_entities as wse_customer", (join) =>
          join
            .onRef("wse_customer.id", "=", "wso.customer_id")
            .on("wse_customer.deleted_at", "is", null)
        )
        .innerJoin("ws_entities as wse_vendor", (join) =>
          join
            .onRef("wse_vendor.id", "=", "wso.vendor_id")
            .on("wse_vendor.deleted_at", "is", null)
        )
        .innerJoin("ws_activities as wsa", (join) =>
          join
            .onRef("wsa.id", "=", "wso.activity_id")
            .on("wsa.deleted_at", "is", null)
        )
        .innerJoin("ws_users as wsu_created", (join) =>
          join
            .onRef("wsu_created.id", "=", "wso.created_by")
            .on("wsu_created.deleted_by", "is", null)
        )
        .innerJoin("ws_order_audits as woa", (join) =>
          join
            .onRef("woa.order_id", "=", "wso.id")
            .on("woa.deleted_at", "is", null)
        )
        .leftJoin("ws_order_statuses as wos", (join) =>
          join
            .onRef("wos.id", "=", "wso.order_status_id")
            .on("wos.deleted_at", "is", null)
        )
        .leftJoin("ws_order_types as wot", (join) =>
          join
            .onRef("wot.id", "=", "wso.order_type_id")
            .on("wot.deleted_at", "is", null)
        )
        .leftJoin("ws_delivery_types as wdt", (join) =>
          join
            .onRef("wdt.id", "=", "wso.delivery_type_id")
            .on("wdt.deleted_at", "is", null)
        )
        .leftJoin("ws_users as wsu_updated", (join) =>
          join
            .onRef("wsu_updated.id", "=", "wso.updated_by")
            .on("wsu_updated.deleted_by", "is", null)
        )
        .leftJoin("locations as province_customer", (join) =>
          join.onRef("province_customer.id", "=", "wse_customer.province_id")
        )
        .leftJoin("locations as regency_customer", (join) =>
          join.onRef("regency_customer.id", "=", "wse_customer.regency_id")
        )
        .leftJoin("locations as province_vendor", (join) =>
          join.onRef("province_vendor.id", "=", "wse_vendor.province_id")
        )
        .leftJoin("locations as regency_vendor", (join) =>
          join.onRef("regency_vendor.id", "=", "wse_vendor.regency_id")
        )
        .select([
          "wso.id as order_id",
          "wso.device_type",
          "wso.order_status_id as status_id",
          "wos.name as status_name",
          "wso.order_type_id as type_id",
          "wso.delivery_type_id as delivery_type_id",
          "wot.name as type_name",
          "wso.created_at as order_created_at",
          "wso.updated_at as order_updated_at",
          "wso.total_order_items",
          "wso.created_by as user_created_by",
          sql<string>`CONCAT_WS(' ', wsu_created.firstname, wsu_created.lastname)`.as(
            "created_by_name"
          ),
          "wso.updated_by as user_updated_by",
          sql<string>`CONCAT_WS(' ', wsu_updated.firstname, wsu_updated.lastname)`.as(
            "updated_by_name"
          ),
          "wse_vendor.id as vendor_id",
          "wse_vendor.name as vendor_name",
          "wse_vendor.entity_tag_id as vendor_entity_tag_id",
          "wse_vendor.province_id as vendor_province_id",
          "wse_vendor.regency_id as vendor_regency_id",
          "wse_customer.province_id as customer_province_id",
          "wse_customer.regency_id as customer_regency_id",
          "province_vendor.name as vendor_province_name",
          "regency_vendor.name as vendor_regency_name",
          "wse_customer.id as customer_id",
          "wse_customer.name as customer_name",
          "wse_customer.entity_tag_id as customer_entity_tag_id",
          "province_customer.name as customer_province_name",
          "regency_customer.name as customer_regency_name",
          "wsa.id as activity_id",
          "wsa.name as activity_name",
          "wsa.program_id as program_id",
          "woa.confirmed_by",
          "woa.shipped_by",
          "woa.fulfilled_by",
          "woa.cancelled_by",
          "woa.allocated_by",
          "woa.confirmed_at",
          "woa.shipped_at",
          "woa.fulfilled_at",
          "woa.cancelled_at",
          "woa.allocated_at",
          "wdt.name as delivery_type_name",
          "wso.no_document as doc_no",
          "wso.notes",
          "wso.no_po as po_no",
          "wso.is_allocated",
          "wso.delivery_number",
          "wso.purchase_ref",
          "wso.sales_ref",
          "wso.metadata",
        ])
        .where("wso.deleted_at", "is", null)
        .where("wso.activity_id", "is not", null)
    )
    .execute()
}
