import type { Kysely } from "kysely"
import { DB } from "../types/db.js"

export async function seed(db: Kysely<DB>): Promise<void> {
  await db.schema
    .createView("ws_asset_vendors")
    .orReplace()
    .as(
      db
        .selectFrom("asset_vendor_workspaces as avw")
        .innerJoin("asset_vendors as av", "av.id", "avw.asset_vendor_id")
        .innerJoin(
          "asset_vendor_types as avt",
          "avt.id",
          "av.asset_vendor_type_id"
        )
        .select([
          "avw.id as id",
          "av.id as global_id",
          "avw.workspace_id as program_id",
          "av.name",
          "avt.id as asset_vendor_type_id",
          "avt.name as asset_vendor_type_name",
          "av.description",
          "avw.status",
          "av.created_by",
          "av.updated_by",
          "av.created_at",
          "av.updated_at",
        ])
    )
    .execute()

  await db.schema
    .createView("ws_asset_types")
    .orReplace()
    .as(
      db
        .selectFrom("asset_type_workspaces as atw")
        .innerJoin("asset_types as at", "at.id", "atw.asset_type_id")
        .select([
          "atw.id as id",
          "at.id as global_id",
          "atw.workspace_id as program_id",
          "at.name",
          "at.description",
          "at.min_temperature",
          "at.max_temperature",
          "atw.status",
          "at.created_by",
          "at.updated_by",
          "at.created_at",
          "at.updated_at",
        ])
    )
    .execute()

  await db.schema
    .createView("ws_asset_models")
    .orReplace()
    .as(
      db
        .selectFrom("asset_model_workspaces as amw")
        .innerJoin("asset_models as am", "am.id", "amw.asset_model_id")
        .innerJoin("asset_types as at", "at.id", "am.asset_type_id")
        .innerJoin("manufactures as m", "m.id", "am.manufacture_id")
        .select([
          "amw.id as id",
          "am.id as global_id",
          "amw.workspace_id as program_id",
          "am.name",
          "at.id as asset_type_id",
          "at.name as asset_type_name",
          "m.id as manufacture_id",
          "m.name as manufacture_name",
          "am.net_capacity",
          "am.gross_capacity",
          "amw.status",
          "am.created_by",
          "am.updated_by",
          "am.created_at",
          "am.updated_at",
        ])
    )
    .execute()
}
