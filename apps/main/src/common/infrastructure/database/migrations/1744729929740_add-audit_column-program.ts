import { Kysely } from "kysely"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .alterTable("workspaces")
    .addColumn("description", "varchar(255)")
    .addColumn("deleted_at", "datetime")
    .addColumn("created_by", "bigint")
    .addColumn("updated_by", "bigint")
    .addColumn("deleted_by", "bigint")
    .execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema
    .alterTable("workspaces")
    .dropColumn("description")
    .dropColumn("deleted_at")
    .dropColumn("created_by")
    .dropColumn("updated_by")
    .dropColumn("deleted_by")
    .execute()
}
