import type { Kysely } from "kysely"
import { DB } from "../types/db.js"

export async function seed(db: Kysely<DB>): Promise<void> {
  await db.schema
    .createView("ws_manufactures")
    .orReplace()
    .as(
      db
        .selectFrom("manufacture_workspaces as mw")
        .innerJoin("manufactures as m", "m.id", "mw.manufacture_id")
        .select([
          "mw.id as id",
          "m.id as global_id",
          "mw.workspace_id as program_id",
          "m.name",
          "m.type",
          "m.reference_id",
          "m.description",
          "m.contact_name",
          "m.phone_number",
          "m.email",
          "m.address",
          "mw.status",
          "m.created_by",
          "mw.updated_by",
          "m.deleted_by",
          "m.created_at",
          "m.updated_at",
          "m.deleted_at",
        ])
    )
    .execute()
}
