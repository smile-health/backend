import type { Kysely } from "kysely"
import { DB } from "../types/db.js"

export async function seed(db: Kysely<DB>): Promise<void> {
  await db.schema
    .createView("ws_budget_sources")
    .orReplace()
    .as(
      db
        .selectFrom("budget_source_workspaces as bw")
        .innerJoin("budget_sources as bs", "bs.id", "bw.budget_source_id")
        .select([
          "bw.id as id",
          "bs.id as global_id",
          "bw.workspace_id as program_id",
          "bs.name",
          "bs.description",
          "bw.status",
          "bs.is_restricted",
          "bs.created_by",
          "bs.updated_by",
          "bs.deleted_by",
          "bs.created_at",
          "bs.updated_at",
          "bs.deleted_at",
        ])
    )
    .execute()
}
