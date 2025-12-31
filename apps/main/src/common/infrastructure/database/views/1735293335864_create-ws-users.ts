import type { Kysely } from "kysely"
import { DB } from "../types/db.js"

export async function seed(db: Kysely<DB>): Promise<void> {
  await db.schema
    .createView("ws_users")
    .orReplace()
    .as(
      db
        .selectFrom("user_workspaces as uw")
        .innerJoin("users as u", "u.id", "uw.user_id")
        .innerJoin("entity_workspaces as ew", (join) =>
          join
            .onRef("ew.entity_id", "=", "u.entity_id")
            .onRef("ew.workspace_id", "=", "uw.workspace_id")
        )
        .leftJoin("manufacture_workspaces as mw", (join) =>
          join
            .onRef("mw.manufacture_id", "=", "u.manufacture_id")
            .onRef("mw.workspace_id", "=", "uw.workspace_id")
        )
        .select([
          "uw.id as id",
          "u.id as global_id",
          "uw.workspace_id as program_id",
          "u.username",
          "u.email",
          "u.firstname",
          "u.lastname",
          "u.date_of_birth",
          "u.gender",
          "u.mobile_phone",
          "u.address",
          "u.role",
          "u.village_id",
          "ew.id as entity_id",
          "u.timezone_id",
          "u.token_login",
          "uw.status",
          "u.last_login",
          "u.last_device",
          "u.mobile_phone_2",
          "u.mobile_phone_brand",
          "u.mobile_phone_model",
          "u.imei_number",
          "u.sim_provider",
          "u.sim_id",
          "u.iota_app_gui_theme",
          "u.permission",
          "u.application_version",
          "u.last_mobile_access",
          "u.view_only",
          "u.change_password",
          "mw.id as manufacture_id",
          "u.fcm_token",
          "u.created_by",
          "u.updated_by",
          "u.deleted_by",
          "u.created_at",
          "u.updated_at",
          "u.keycloak_uuid",
          "u.user_uuid",
        ])
    )
    .execute()
}
