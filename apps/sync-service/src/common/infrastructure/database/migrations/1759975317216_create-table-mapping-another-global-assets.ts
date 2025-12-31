import type { Kysely } from "kysely"
import pluralize from "pluralize"
import { addTimestampColumns } from "../helper.js"
import { Database } from "../types/index.js"
const tables = ["volume_material", "model_relations", "cce", "cceigat", "pqs"]

export async function up(db: Kysely<Database>): Promise<void> {
  await Promise.all(
    tables.map(async (table) => {
      const colName = pluralize.singular(table)
      await db.schema
        .createTable(`mapping_${table}`)
        .addColumn("id", "bigint", (col) => col.autoIncrement().primaryKey())
        .addColumn("program_id", "bigint", (col) => col.notNull())
        .addColumn(`platform_${colName}_id`, "bigint", (col) => col.notNull())
        .addColumn(`existing_${colName}_id`, "bigint", (col) => col.notNull())
        .$call(addTimestampColumns)
        .execute()

      await db.schema
        .createIndex(`idx_mapping_${table}_platform_${colName}_id`)
        .on(`mapping_${table}`)
        .column(`platform_${colName}_id`)
        .column(`program_id`)
        .execute()
    })
  )
}

export async function down(db: Kysely<Database>): Promise<void> {
  await Promise.all(
    tables.map(async (table) => {
      await db.schema.dropTable(`mapping_${table}`).execute()
    })
  )
}
