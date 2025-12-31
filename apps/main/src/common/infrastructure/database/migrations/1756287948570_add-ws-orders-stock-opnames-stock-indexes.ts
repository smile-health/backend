import { Kysely } from "kysely"
import { Database } from "../../../../../../core/src/common/infrastructure/database/types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  // High priority indexes for ws_orders table
  await db.schema
    .createIndex("idx_ws_orders_customer_id")
    .on("ws_orders")
    .column("customer_id")
    .execute()

  await db.schema
    .createIndex("idx_ws_orders_vendor_id")
    .on("ws_orders")
    .column("vendor_id")
    .execute()

  await db.schema
    .createIndex("idx_ws_orders_order_status_id")
    .on("ws_orders")
    .column("order_status_id")
    .execute()

  await db.schema
    .createIndex("idx_ws_orders_order_type_id")
    .on("ws_orders")
    .column("order_type_id")
    .execute()

  await db.schema
    .createIndex("idx_ws_orders_created_at")
    .on("ws_orders")
    .column("created_at")
    .execute()

  await db.schema
    .createIndex("idx_ws_orders_updated_at")
    .on("ws_orders")
    .column("updated_at")
    .execute()

  await db.schema
    .createIndex("idx_ws_orders_activity_id")
    .on("ws_orders")
    .column("activity_id")
    .execute()

  await db.schema
    .createIndex("idx_ws_orders_delivery_type_id")
    .on("ws_orders")
    .column("delivery_type_id")
    .execute()

  await db.schema
    .createIndex("idx_ws_orders_validated_by")
    .on("ws_orders")
    .column("validated_by")
    .execute()

  await db.schema
    .createIndex("idx_ws_orders_validated_at")
    .on("ws_orders")
    .column("validated_at")
    .execute()

  // Composite indexes for ws_orders
  await db.schema
    .createIndex("idx_ws_orders_customer_status")
    .on("ws_orders")
    .columns(["customer_id", "order_status_id"])
    .execute()

  await db.schema
    .createIndex("idx_ws_orders_vendor_status")
    .on("ws_orders")
    .columns(["vendor_id", "order_status_id"])
    .execute()

  await db.schema
    .createIndex("idx_ws_orders_status_created")
    .on("ws_orders")
    .columns(["order_status_id", "created_at"])
    .execute()

  await db.schema
    .createIndex("idx_ws_orders_customer_created")
    .on("ws_orders")
    .columns(["customer_id", "created_at"])
    .execute()

  // High priority indexes for ws_stock_opnames table
  await db.schema
    .createIndex("idx_ws_stock_opnames_period_id")
    .on("ws_stock_opnames")
    .column("period_id")
    .execute()

  await db.schema
    .createIndex("idx_ws_stock_opnames_entity_id")
    .on("ws_stock_opnames")
    .column("entity_id")
    .execute()

  await db.schema
    .createIndex("idx_ws_stock_opnames_material_id")
    .on("ws_stock_opnames")
    .column("material_id")
    .execute()

  await db.schema
    .createIndex("idx_ws_stock_opnames_activity_id")
    .on("ws_stock_opnames")
    .column("activity_id")
    .execute()

  await db.schema
    .createIndex("idx_ws_stock_opnames_stock_id")
    .on("ws_stock_opnames")
    .column("stock_id")
    .execute()

  await db.schema
    .createIndex("idx_ws_stock_opnames_created_at")
    .on("ws_stock_opnames")
    .column("created_at")
    .execute()

  await db.schema
    .createIndex("idx_ws_stock_opnames_parent_material_id")
    .on("ws_stock_opnames")
    .column("parent_material_id")
    .execute()

  await db.schema
    .createIndex("idx_ws_stock_opnames_manufacture_id")
    .on("ws_stock_opnames")
    .column("manufacture_id")
    .execute()

  await db.schema
    .createIndex("idx_ws_stock_opnames_expired_date")
    .on("ws_stock_opnames")
    .column("expired_date")
    .execute()

  await db.schema
    .createIndex("idx_ws_stock_opnames_production_date")
    .on("ws_stock_opnames")
    .column("production_date")
    .execute()

  // Composite indexes for ws_stock_opnames
  await db.schema
    .createIndex("idx_ws_stock_opnames_entity_material")
    .on("ws_stock_opnames")
    .columns(["entity_id", "material_id"])
    .execute()

  await db.schema
    .createIndex("idx_ws_stock_opnames_period_entity")
    .on("ws_stock_opnames")
    .columns(["period_id", "entity_id"])
    .execute()

  await db.schema
    .createIndex("idx_ws_stock_opnames_material_expired")
    .on("ws_stock_opnames")
    .columns(["material_id", "expired_date"])
    .execute()

  await db.schema
    .createIndex("idx_ws_stock_opnames_entity_activity")
    .on("ws_stock_opnames")
    .columns(["entity_id", "activity_id"])
    .execute()

  // High priority indexes for ws_stocks table (excluding created_by and updated_by)
  await db.schema
    .createIndex("idx_ws_stocks_batch_id")
    .on("ws_stocks")
    .column("batch_id")
    .execute()

  await db.schema
    .createIndex("idx_ws_stocks_entity_id")
    .on("ws_stocks")
    .column("entity_id")
    .execute()

  await db.schema
    .createIndex("idx_ws_stocks_material_id")
    .on("ws_stocks")
    .column("material_id")
    .execute()

  await db.schema
    .createIndex("idx_ws_stocks_parent_material_id")
    .on("ws_stocks")
    .column("parent_material_id")
    .execute()

  await db.schema
    .createIndex("idx_ws_stocks_activity_id")
    .on("ws_stocks")
    .column("activity_id")
    .execute()

  await db.schema
    .createIndex("idx_ws_stocks_budget_source_id")
    .on("ws_stocks")
    .column("budget_source_id")
    .execute()

  await db.schema
    .createIndex("idx_ws_stocks_stock_quality_id")
    .on("ws_stocks")
    .column("stock_quality_id")
    .execute()

  await db.schema
    .createIndex("idx_ws_stocks_year")
    .on("ws_stocks")
    .column("year")
    .execute()

  await db.schema
    .createIndex("idx_ws_stocks_created_at")
    .on("ws_stocks")
    .column("created_at")
    .execute()

  await db.schema
    .createIndex("idx_ws_stocks_updated_at")
    .on("ws_stocks")
    .column("updated_at")
    .execute()

  await db.schema
    .createIndex("idx_ws_stocks_manufacture_id")
    .on("ws_stocks")
    .column("manufacture_id")
    .execute()

  // Composite indexes for ws_stocks
  await db.schema
    .createIndex("idx_ws_stocks_entity_material")
    .on("ws_stocks")
    .columns(["entity_id", "material_id"])
    .execute()

  await db.schema
    .createIndex("idx_ws_stocks_material_activity")
    .on("ws_stocks")
    .columns(["material_id", "activity_id"])
    .execute()

  await db.schema
    .createIndex("idx_ws_stocks_entity_year")
    .on("ws_stocks")
    .columns(["entity_id", "year"])
    .execute()

  await db.schema
    .createIndex("idx_ws_stocks_material_year")
    .on("ws_stocks")
    .columns(["material_id", "year"])
    .execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  // Drop ws_orders indexes
  await db.schema.dropIndex("idx_ws_orders_customer_id").on("ws_orders").execute()
  await db.schema.dropIndex("idx_ws_orders_vendor_id").on("ws_orders").execute()
  await db.schema.dropIndex("idx_ws_orders_order_status_id").on("ws_orders").execute()
  await db.schema.dropIndex("idx_ws_orders_order_type_id").on("ws_orders").execute()
  await db.schema.dropIndex("idx_ws_orders_created_at").on("ws_orders").execute()
  await db.schema.dropIndex("idx_ws_orders_updated_at").on("ws_orders").execute()
  await db.schema.dropIndex("idx_ws_orders_activity_id").on("ws_orders").execute()
  await db.schema.dropIndex("idx_ws_orders_delivery_type_id").on("ws_orders").execute()
  await db.schema.dropIndex("idx_ws_orders_validated_by").on("ws_orders").execute()
  await db.schema.dropIndex("idx_ws_orders_validated_at").on("ws_orders").execute()
  
  // Drop composite indexes for ws_orders
  await db.schema.dropIndex("idx_ws_orders_customer_status").on("ws_orders").execute()
  await db.schema.dropIndex("idx_ws_orders_vendor_status").on("ws_orders").execute()
  await db.schema.dropIndex("idx_ws_orders_status_created").on("ws_orders").execute()
  await db.schema.dropIndex("idx_ws_orders_customer_created").on("ws_orders").execute()
  
  // Drop ws_stock_opnames indexes
  await db.schema.dropIndex("idx_ws_stock_opnames_period_id").on("ws_stock_opnames").execute()
  await db.schema.dropIndex("idx_ws_stock_opnames_entity_id").on("ws_stock_opnames").execute()
  await db.schema.dropIndex("idx_ws_stock_opnames_material_id").on("ws_stock_opnames").execute()
  await db.schema.dropIndex("idx_ws_stock_opnames_activity_id").on("ws_stock_opnames").execute()
  await db.schema.dropIndex("idx_ws_stock_opnames_stock_id").on("ws_stock_opnames").execute()
  await db.schema.dropIndex("idx_ws_stock_opnames_created_at").on("ws_stock_opnames").execute()
  await db.schema.dropIndex("idx_ws_stock_opnames_parent_material_id").on("ws_stock_opnames").execute()
  await db.schema.dropIndex("idx_ws_stock_opnames_manufacture_id").on("ws_stock_opnames").execute()
  await db.schema.dropIndex("idx_ws_stock_opnames_expired_date").on("ws_stock_opnames").execute()
  await db.schema.dropIndex("idx_ws_stock_opnames_production_date").on("ws_stock_opnames").execute()
  
  // Drop composite indexes for ws_stock_opnames
  await db.schema.dropIndex("idx_ws_stock_opnames_entity_material").on("ws_stock_opnames").execute()
  await db.schema.dropIndex("idx_ws_stock_opnames_period_entity").on("ws_stock_opnames").execute()
  await db.schema.dropIndex("idx_ws_stock_opnames_material_expired").on("ws_stock_opnames").execute()
  await db.schema.dropIndex("idx_ws_stock_opnames_entity_activity").on("ws_stock_opnames").execute()
  
  // Drop ws_stocks indexes
  await db.schema.dropIndex("idx_ws_stocks_batch_id").on("ws_stocks").execute()
  await db.schema.dropIndex("idx_ws_stocks_entity_id").on("ws_stocks").execute()
  await db.schema.dropIndex("idx_ws_stocks_material_id").on("ws_stocks").execute()
  await db.schema.dropIndex("idx_ws_stocks_parent_material_id").on("ws_stocks").execute()
  await db.schema.dropIndex("idx_ws_stocks_activity_id").on("ws_stocks").execute()
  await db.schema.dropIndex("idx_ws_stocks_budget_source_id").on("ws_stocks").execute()
  await db.schema.dropIndex("idx_ws_stocks_stock_quality_id").on("ws_stocks").execute()
  await db.schema.dropIndex("idx_ws_stocks_year").on("ws_stocks").execute()
  await db.schema.dropIndex("idx_ws_stocks_created_at").on("ws_stocks").execute()
  await db.schema.dropIndex("idx_ws_stocks_updated_at").on("ws_stocks").execute()
  await db.schema.dropIndex("idx_ws_stocks_manufacture_id").on("ws_stocks").execute()
  
  // Drop composite indexes for ws_stocks
  await db.schema.dropIndex("idx_ws_stocks_entity_material").on("ws_stocks").execute()
  await db.schema.dropIndex("idx_ws_stocks_material_activity").on("ws_stocks").execute()
  await db.schema.dropIndex("idx_ws_stocks_entity_year").on("ws_stocks").execute()
  await db.schema.dropIndex("idx_ws_stocks_material_year").on("ws_stocks").execute()
}