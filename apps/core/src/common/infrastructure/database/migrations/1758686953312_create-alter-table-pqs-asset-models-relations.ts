import type { Kysely } from "kysely"
import { Database } from "../types/index.js"
import { addAuditColumns, addTimestampColumns } from "../helper"

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .createTable("pqs_codes")
    .addColumn("id", "bigint", (col) => col.autoIncrement().primaryKey())
    .addColumn("code", "varchar(255)", (col) => col.notNull())
    .addColumn("pqs_type_id", "bigint", (col) => col.notNull())
    .addColumn("cceigat_description_id", "bigint", (col) => col.defaultTo(null))
    .$call(addTimestampColumns)
    .$call(addAuditColumns)
    .execute()

  await db.schema
    .createTable("pqs_net_capacities")
    .addColumn("id", "bigint", (col) => col.autoIncrement().primaryKey())
    .addColumn("pqs_code_id", "bigint", (col) => col.notNull())
    .addColumn("temperature_threshold_id", "bigint", (col) => col.notNull())
    .addColumn("net_capacity", "double precision")
    .$call(addTimestampColumns)
    .$call(addAuditColumns)
    .execute()

  await db.schema
    .alterTable("asset_models")
    .addColumn("pqs_code_id", "bigint")
    .execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.dropTable("pqs_codes").execute()
  await db.schema.dropTable("pqs_net_capacities").execute()
  await db.schema.alterTable("asset_models").dropColumn("pqs_code_id").execute()
}
