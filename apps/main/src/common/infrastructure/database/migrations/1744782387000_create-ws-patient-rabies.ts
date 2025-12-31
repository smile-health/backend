import { Kysely } from "kysely"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .createTable("ws_patient_rabies")
    .addColumn("id", "bigint", (col) => col.primaryKey().autoIncrement())
    .addColumn("patient_id", "bigint", (col) => col.notNull().unique())
    .addColumn("vaccine_type", "integer")
    .addColumn("vaccine_method", "integer")
    .addColumn("vaccine_sequence", "integer")
    .addColumn("last_vaccine_at", "datetime")
    .addColumn("stop_notification", "boolean", (col) =>
      col.notNull().defaultTo(false)
    )
    .execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.dropTable("ws_patient_rabies").execute()
}
