import type { Kysely } from "kysely"
import { Database } from "../types"

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .alterTable("entity_workspaces")
    .addColumn("created_by", "bigint")
    .addColumn("updated_by", "bigint")
    .addColumn("deleted_by", "bigint")
    .execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema
    .alterTable("entity_workspaces")
    .dropColumn("created_by")
    .dropColumn("updated_by")
    .dropColumn("deleted_by")
    .execute()
}
