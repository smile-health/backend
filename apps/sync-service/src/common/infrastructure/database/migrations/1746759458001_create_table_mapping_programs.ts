import type { Kysely } from "kysely"
import { addTimestampColumns } from "../helper.js"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .createTable("mapping_programs")
    .addColumn("id", "bigint", (col) => col.autoIncrement().primaryKey())
    .addColumn("platform_program_id", "bigint", (col) => col.notNull())
    .addColumn("existing_program_id", "bigint", (col) => col.notNull())
    .$call(addTimestampColumns)
    .execute()

  await db.schema
    .createIndex("idx_mapping_programs_platform_program_id")
    .on("mapping_programs")
    .column("platform_program_id")
    .execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.dropTable("mapping_programs").execute()
}
