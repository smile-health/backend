import { Kysely } from "kysely"
import { addTimestampColumns } from "../helper.js"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  // Create mapping table for extermination_shipment (disposal transactions)
  await db.schema
    .createTable("mapping_extermination_shipments")
    .addColumn("id", "bigint", (col) => col.autoIncrement().primaryKey())
    .addColumn("program_id", "bigint", (col) => col.notNull())
    .addColumn("platform_extermination_shipment_id", "bigint", (col) =>
      col.notNull()
    )
    .addColumn("existing_extermination_shipment_id", "bigint", (col) =>
      col.notNull()
    )
    .$call(addTimestampColumns)
    .execute()

  await db.schema
    .createIndex("idx_mapping_extermination_shipments_platform_shipment_id")
    .on("mapping_extermination_shipments")
    .column("platform_extermination_shipment_id")
    .column("program_id")
    .execute()

  // Create mapping table for extermination_shipment_comment

  await db.schema
    .createTable("mapping_extermination_shipment_comments")
    .addColumn("id", "bigint", (col) => col.autoIncrement().primaryKey())
    .addColumn("program_id", "bigint", (col) => col.notNull())
    .addColumn("platform_extermination_shipment_comment_id", "bigint", (col) =>
      col.notNull()
    )
    .addColumn("existing_extermination_shipment_comment_id", "bigint", (col) =>
      col.notNull()
    )
    .$call(addTimestampColumns)
    .execute()

  await db.schema
    .createIndex(
      "idx_mapping_extermination_shipment_comments_platform_comment_id"
    )
    .on("mapping_extermination_shipment_comments")
    .column("platform_extermination_shipment_comment_id")
    .column("program_id")
    .execute()

  // Create mapping table for extermination_shipment_item
  await db.schema
    .createTable("mapping_extermination_shipment_items")
    .addColumn("id", "bigint", (col) => col.autoIncrement().primaryKey())
    .addColumn("program_id", "bigint", (col) => col.notNull())
    .addColumn("platform_extermination_shipment_item_id", "bigint", (col) =>
      col.notNull()
    )
    .addColumn("existing_extermination_shipment_item_id", "bigint", (col) =>
      col.notNull()
    )
    .$call(addTimestampColumns)
    .execute()

  await db.schema
    .createIndex("idx_mapping_extermination_shipment_items_platform_type_id")
    .on("mapping_extermination_shipment_items")
    .column("platform_extermination_shipment_item_id")
    .column("program_id")
    .execute()

  // Create mapping table for extermination_shipment_stocks
  await db.schema
    .createTable("mapping_extermination_shipment_stocks")
    .addColumn("id", "bigint", (col) => col.autoIncrement().primaryKey())
    .addColumn("program_id", "bigint", (col) => col.notNull())
    .addColumn("platform_extermination_shipment_stock_id", "bigint", (col) =>
      col.notNull()
    )
    .addColumn("existing_extermination_shipment_stock_id", "bigint", (col) =>
      col.notNull()
    )
    .$call(addTimestampColumns)
    .execute()

  await db.schema
    .createIndex("idx_mapping_extermination_shipment_stocks_platform_reason_id")
    .on("mapping_extermination_shipment_stocks")
    .column("platform_extermination_shipment_stock_id")
    .column("program_id")
    .execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.dropTable("mapping_extermination_shipments").execute()
  await db.schema.dropTable("mapping_extermination_shipment_comments").execute()
  await db.schema.dropTable("mapping_extermination_shipment_items").execute()
  await db.schema.dropTable("mapping_extermination_shipment_stocks").execute()
}
