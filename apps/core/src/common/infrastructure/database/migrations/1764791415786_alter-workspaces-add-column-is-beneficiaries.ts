import type { Kysely } from "kysely"
import { Database } from "../types"

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .alterTable("workspaces")
    .addColumn("is_beneficiaries", "boolean", (col) => col.defaultTo(false))
    .execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema
    .alterTable("workspaces")
    .dropColumn("is_beneficiaries")
    .execute()
}
