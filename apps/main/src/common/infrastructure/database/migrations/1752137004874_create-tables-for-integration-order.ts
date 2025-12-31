import { sql, type Kysely } from "kysely"
import { addTimestampColumns } from "../helper.js"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .createTable("integration_clients")
    .addColumn("id", "bigint", (col) => col.primaryKey().autoIncrement())
    .addColumn("key", "varchar(255)", (col) => col.notNull().unique())
    .addColumn("name", "varchar(255)", (col) => col.notNull())
    .addColumn("config", "text", (col) => col.defaultTo(""))
    .$call(addTimestampColumns)
    .execute()

  await db.schema
    .createTable("integration_mappings")
    .addColumn("id", "bigint", (col) => col.primaryKey().autoIncrement())
    .addColumn("type", "varchar(255)", (col) => col.notNull())
    .addColumn("internal_id", "bigint", (col) => col.notNull())
    .addColumn("external_id", "varchar(255)", (col) => col.notNull())
    .addColumn("client_id", "bigint")
    .$call(addTimestampColumns)
    .execute()

  await db.schema
    .createIndex(`idx_integration_mappings_type_internal_id`)
    .on(`integration_mappings`)
    .column(`type`)
    .column(`internal_id`)
    .execute()

  await db.schema
    .createIndex(`idx_integration_mappings_type_external_id`)
    .on(`integration_mappings`)
    .column(`type`)
    .column(`external_id`)
    .execute()

  await db.schema
    .createTable("integration_logs")
    .addColumn("id", "bigint", (col) => col.primaryKey().autoIncrement())
    .addColumn("client_id", "bigint")
    .addColumn("source_id", "bigint")
    .addColumn("source_type", "varchar(255)", (col) => col.notNull())
    .addColumn("flow", "varchar(255)", (col) => col.notNull())
    .addColumn("tag", "varchar(255)", (col) => col.notNull())
    .addColumn("request", sql`LONGTEXT`, (col) => col.defaultTo(""))
    .addColumn("response", sql`LONGTEXT`, (col) => col.defaultTo(""))
    .$call(addTimestampColumns)
    .execute()

  await db.schema
    .alterTable("ws_orders")
    .addColumn("metadata", "text", (col) => col.defaultTo(""))
    .execute()

  await db.schema
    .alterTable("ws_order_audits")
    .addColumn("drafted_by", "integer")
    .addColumn("validated_by", "integer")
    .addColumn("drafted_at", "datetime")
    .addColumn("validated_at", "datetime")
    .execute()

  await db.schema
    .alterTable("ws_order_item_stocks")
    .addColumn("metadata", "text", (col) => col.defaultTo(""))
    .execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await Promise.all([
    db.schema.dropTable("integration_clients").execute(),
    db.schema.dropTable("integration_mappings").execute(),
    db.schema.dropTable("integration_logs").execute(),
  ])
}
