import type { Kysely } from "kysely"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .alterTable("asset_vendor_types")
    .addColumn("deleted_by", "bigint")
    .addColumn("deleted_at", "datetime")
    .execute()

  await db.schema
    .alterTable("asset_vendors")
    .addColumn("deleted_by", "bigint")
    .addColumn("deleted_at", "datetime")
    .execute()

  await db.schema
    .alterTable("asset_vendor_workspaces")
    .addColumn("deleted_by", "bigint")
    .addColumn("deleted_at", "datetime")
    .execute()

  await db.schema
    .alterTable("asset_types")
    .addColumn("deleted_by", "bigint")
    .addColumn("deleted_at", "datetime")
    .execute()

  await db.schema
    .alterTable("asset_type_workspaces")
    .addColumn("deleted_by", "bigint")
    .addColumn("deleted_at", "datetime")
    .execute()

  await db.schema
    .alterTable("asset_models")
    .addColumn("deleted_by", "bigint")
    .addColumn("deleted_at", "datetime")
    .execute()

  await db.schema
    .alterTable("asset_model_workspaces")
    .addColumn("deleted_by", "bigint")
    .addColumn("deleted_at", "datetime")
    .execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema
    .alterTable("asset_vendor_types")
    .dropColumn("deleted_by")
    .dropColumn("deleted_at")
    .execute()

  await db.schema
    .alterTable("asset_vendors")
    .dropColumn("deleted_by")
    .dropColumn("deleted_at")
    .execute()

  await db.schema
    .alterTable("asset_vendor_workspaces")
    .dropColumn("deleted_by")
    .dropColumn("deleted_at")
    .execute()

  await db.schema
    .alterTable("asset_types")
    .dropColumn("deleted_by")
    .dropColumn("deleted_at")
    .execute()

  await db.schema
    .alterTable("asset_type_workspaces")
    .dropColumn("deleted_by")
    .dropColumn("deleted_at")
    .execute()

  await db.schema
    .alterTable("asset_models")
    .dropColumn("deleted_by")
    .dropColumn("deleted_at")
    .execute()

  await db.schema
    .alterTable("asset_model_workspaces")
    .dropColumn("deleted_by")
    .dropColumn("deleted_at")
    .execute()
}
