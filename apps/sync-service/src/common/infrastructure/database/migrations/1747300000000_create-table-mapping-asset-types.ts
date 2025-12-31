import { Kysely } from "kysely"
import { addTimestampColumns } from "../helper.js"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  // Create mapping table for asset_types
  await db.schema
    .createTable("mapping_asset_types")
    .addColumn("id", "bigint", (col) => col.autoIncrement().primaryKey())
    .addColumn("program_id", "bigint", (col) => col.notNull())
    .addColumn("platform_asset_type_id", "bigint", (col) => col.notNull())
    .addColumn("existing_asset_type_id", "bigint", (col) => col.notNull())
    .$call(addTimestampColumns)
    .execute()

  await db.schema
    .createIndex("idx_mapping_asset_types_platform_asset_type_id")
    .on("mapping_asset_types")
    .column("platform_asset_type_id")
    .column("program_id")
    .execute()

  // Create mapping table for asset_models
  await db.schema
    .createTable("mapping_asset_models")
    .addColumn("id", "bigint", (col) => col.autoIncrement().primaryKey())
    .addColumn("program_id", "bigint", (col) => col.notNull())
    .addColumn("platform_asset_model_id", "bigint", (col) => col.notNull())
    .addColumn("existing_asset_model_id", "bigint", (col) => col.notNull())
    .$call(addTimestampColumns)
    .execute()

  await db.schema
    .createIndex("idx_mapping_asset_models_platform_asset_model_id")
    .on("mapping_asset_models")
    .column("platform_asset_model_id")
    .column("program_id")
    .execute()

  // Create mapping table for assets
  await db.schema
    .createTable("mapping_assets")
    .addColumn("id", "bigint", (col) => col.autoIncrement().primaryKey())
    .addColumn("program_id", "bigint", (col) => col.notNull())
    .addColumn("platform_asset_id", "bigint", (col) => col.notNull())
    .addColumn("existing_asset_id", "bigint", (col) => col.notNull())
    .$call(addTimestampColumns)
    .execute()

  await db.schema
    .createIndex("idx_mapping_assets_platform_asset_id")
    .on("mapping_assets")
    .column("platform_asset_id")
    .column("program_id")
    .execute()

  // Create mapping table for asset_vendors
  await db.schema
    .createTable("mapping_asset_vendors")
    .addColumn("id", "bigint", (col) => col.autoIncrement().primaryKey())
    .addColumn("program_id", "bigint", (col) => col.notNull())
    .addColumn("platform_asset_vendor_id", "bigint", (col) => col.notNull())
    .addColumn("existing_asset_vendor_id", "bigint", (col) => col.notNull())
    .$call(addTimestampColumns)
    .execute()

  await db.schema
    .createIndex("idx_mapping_asset_vendors_platform_asset_vendor_id")
    .on("mapping_asset_vendors")
    .column("platform_asset_vendor_id")
    .column("program_id")
    .execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.dropTable("mapping_asset_vendors").execute()
  await db.schema.dropTable("mapping_assets").execute()
  await db.schema.dropTable("mapping_asset_models").execute()
  await db.schema.dropTable("mapping_asset_types").execute()
}
