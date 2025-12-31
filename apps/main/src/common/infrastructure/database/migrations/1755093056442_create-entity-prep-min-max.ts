import { Kysely } from "kysely"
import { addTimestampColumns } from "../helper.js"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .createTable("entity_prep_min_max")
    .addColumn("id", "bigint", (col) => col.autoIncrement().primaryKey())
    .addColumn("program_id", "bigint", (col) => col.notNull())
    .addColumn("entity_id", "bigint")
    .addColumn("distribution_time", "float4")
    .addColumn("lead_time", "float4")
    .$call(addTimestampColumns)
    .execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.dropTable("entity_prep_min_max").execute()
}
