import type { Kysely } from "kysely"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .alterTable("ws_asset_working_statuses")
    .addColumn("deleted_by", "bigint")
    .addColumn("deleted_at", "datetime")
    .execute()

  await db.schema
    .alterTable("ws_asset_electricities")
    .addColumn("deleted_by", "bigint")
    .addColumn("deleted_at", "datetime")
    .execute()

  await db.schema
    .alterTable("ws_asset_calibration_schedules")
    .addColumn("deleted_by", "bigint")
    .addColumn("deleted_at", "datetime")
    .execute()

  await db.schema
    .alterTable("ws_asset_maintenance_schedules")
    .addColumn("deleted_by", "bigint")
    .addColumn("deleted_at", "datetime")
    .execute()

  await db.schema
    .alterTable("ws_asset_inventories")
    .addColumn("deleted_by", "bigint")
    .addColumn("deleted_at", "datetime")
    .execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema
    .alterTable("ws_asset_working_statuses")
    .dropColumn("deleted_by")
    .dropColumn("deleted_at")
    .execute()

  await db.schema
    .alterTable("ws_asset_electricities")
    .dropColumn("deleted_by")
    .dropColumn("deleted_at")
    .execute()

  await db.schema
    .alterTable("ws_asset_calibration_schedules")
    .dropColumn("deleted_by")
    .dropColumn("deleted_at")
    .execute()

  await db.schema
    .alterTable("ws_asset_maintenance_schedules")
    .dropColumn("deleted_by")
    .dropColumn("deleted_at")
    .execute()

  await db.schema
    .alterTable("ws_asset_inventories")
    .dropColumn("deleted_by")
    .dropColumn("deleted_at")
    .execute()
}
