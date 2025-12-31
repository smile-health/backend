import { Kysely } from "kysely"
import { addAuditColumns, addTimestampColumns } from "../helper.js"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .createTable("ws_consumptions")
    .addColumn("id", "bigint", (col) => col.autoIncrement().primaryKey())
    .addColumn("transaction_id", "bigint")
    .addColumn("patient_id", "bigint")
    .addColumn("vaccine_sequence_id", "bigint")
    .addColumn("vaccine_method", "smallint")
    .addColumn("expired_date", "datetime")
    .$call(addAuditColumns)
    .$call(addTimestampColumns)
    .execute()

  await db.schema
    .createTable("ws_vaccine_sequences")
    .addColumn("id", "bigint", (col) => col.autoIncrement().primaryKey())
    .addColumn("activity_id", "bigint")
    .addColumn("name", "varchar(255)")
    .$call(addAuditColumns)
    .$call(addTimestampColumns)
    .execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await Promise.allSettled([
    db.schema.dropTable("ws_vaccine_sequences").execute(),
    db.schema.dropTable("ws_consumptions").execute(),
  ])
}
