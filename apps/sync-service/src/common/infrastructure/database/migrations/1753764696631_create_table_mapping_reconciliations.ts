import type { Kysely } from "kysely"
import { addTimestampColumns } from "../helper.js"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .createTable(`mapping_reconciliations`)
    .addColumn("id", "bigint", (col) => col.autoIncrement().primaryKey())
    .addColumn("program_id", "bigint", (col) => col.notNull())
    .addColumn(`platform_reconciliation_id`, "bigint", (col) => col.notNull())
    .addColumn(`existing_reconciliation_id`, "bigint", (col) => col.notNull())
    .$call(addTimestampColumns)
    .execute()

  await db.schema
    .createIndex(`idx_mapping_reconciliations_platform_reconciliation_id`)
    .on(`mapping_reconciliations`)
    .column(`platform_reconciliation_id`)
    .execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.dropTable("mapping_reconciliations").execute()
}
