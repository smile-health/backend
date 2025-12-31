import type { Kysely } from "kysely"
import { addTimestampColumns } from "../helper.js"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .createTable(`mapping_communication_providers`)
    .addColumn("id", "bigint", (col) => col.autoIncrement().primaryKey())
    .addColumn("program_id", "bigint", (col) => col.notNull())
    .addColumn(`platform_communication_provider_id`, "bigint", (col) =>
      col.notNull()
    )
    .addColumn(`existing_communication_provider_id`, "bigint", (col) =>
      col.notNull()
    )
    .$call(addTimestampColumns)
    .execute()

  await db.schema
    .createIndex(`idx_mapping_communication_providers_platform_provider_id`)
    .on(`mapping_communication_providers`)
    .column(`platform_communication_provider_id`)
    .column(`program_id`)
    .execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.dropTable("mapping_communication_providers").execute()
}
