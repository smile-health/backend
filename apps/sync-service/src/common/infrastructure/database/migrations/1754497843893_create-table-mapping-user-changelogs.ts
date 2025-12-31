import type { Kysely } from "kysely"
import { addTimestampColumns } from "../helper.js"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .createTable(`mapping_user_changelogs`)
    .addColumn("id", "bigint", (col) => col.autoIncrement().primaryKey())
    .addColumn("program_id", "bigint", (col) => col.notNull())
    .addColumn(`platform_user_changelog_id`, "bigint", (col) => col.notNull())
    .addColumn(`existing_user_changelog_id`, "bigint", (col) => col.notNull())
    .addColumn("platform_global_id", "bigint")
    .$call(addTimestampColumns)
    .execute()

  await db.schema
    .createIndex(`idx_mapping_user_changelogs_platform_user_changelog_id`)
    .on(`mapping_user_changelogs`)
    .column(`platform_user_changelog_id`)
    .column(`program_id`)
    .execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.dropTable("mapping_user_changelogs").execute()
}
