import type { Kysely } from "kysely"
import { DB } from "../types/db.js"

export async function seed(db: Kysely<DB>): Promise<void> {
  await db.schema
    .createView("ws_entities")
    .orReplace()
    .as(
      db
        .selectFrom("entity_workspaces as ew")
        .innerJoin("entities as e", "e.id", "ew.entity_id")
        .innerJoin("entity_tags as et", "et.id", "e.entity_tag_id")
        .select([
          "ew.id as id",
          "e.id as global_id",
          "ew.workspace_id as program_id",
          "ew.status as status",
          "e.id_satu_sehat",
          "e.entity_tag_id",
          "e.code",
          "e.type",
          "e.name",
          "e.address",
          "e.country",
          "e.village_id",
          "e.province_id",
          "e.regency_id",
          "e.sub_district_id",
          "e.postal_code",
          "e.lat",
          "e.lng",
          "e.is_puskesmas",
          "ew.is_vendor",
          "e.created_by",
          "e.updated_by",
          "e.created_at",
          "e.updated_at",
          "ew.deleted_at",
          "et.is_open_vial",
          "ew.is_relocation",
        ])
    )
    .execute()
}
