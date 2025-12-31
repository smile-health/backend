import { type Kysely } from "kysely"
import { addTimestampColumns } from "../helper.js"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .createTable("integration_associations")
    .ifNotExists()
    .addColumn("id", "bigint", (col) => col.primaryKey().autoIncrement())
    .addColumn("type", "varchar(255)", (col) => col.notNull())
    .addColumn("internal_id", "bigint", (col) => col.notNull())
    .addColumn("client_id", "bigint")
    .addColumn("metadata", "text", (col) => col.defaultTo(""))
    .$call(addTimestampColumns)
    .addUniqueConstraint("unique_constraint_type_internal_id_client_id", [
      "type",
      "internal_id",
      "client_id",
    ])
    .execute()

  await db.schema
    .createIndex(`idx_integration_type_internal_id`)
    .on(`integration_associations`)
    .column(`type`)
    .column(`internal_id`)
    .column("client_id")
    .execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await Promise.all([db.schema.dropTable("integration_associations").execute()])
}
