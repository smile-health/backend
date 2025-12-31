/* eslint-disable @typescript-eslint/no-explicit-any */
import { Kysely } from "kysely"
import { addAuditColumns, addTimestampColumns } from "../helper.js"

export async function up(db: Kysely<any>): Promise<void> {
  // ws_disposal_instructions
  await db.schema
    .createTable("ws_disposal_instructions")
    .ifNotExists()
    .addColumn("id", "bigint", (col) =>
      col.autoIncrement().primaryKey().unsigned()
    )
    .addColumn("entity_id", "bigint", (col) => col.notNull())
    .addColumn("activity_id", "bigint", (col) => col.notNull())
    .addColumn("disposal_instruction_type_id", "integer")
    .addColumn("device_type", "integer")
    .addColumn("report_number", "varchar(255)", (col) => col.unique())
    .addColumn("item_count", "integer")
    .addColumn("status", "integer")
    .$call(addTimestampColumns)
    .$call(addAuditColumns)
    .execute()

  // ws_disposal_instruction_comments
  await db.schema
    .createTable("ws_disposal_instruction_comments")
    .ifNotExists()
    .addColumn("id", "bigint", (col) =>
      col.autoIncrement().primaryKey().unsigned()
    )
    .addColumn("disposal_instruction_id", "bigint", (col) => col.notNull())
    .addColumn("comment", "text")
    .addColumn("status", "integer")
    .addColumn("user_id", "bigint")
    .$call(addTimestampColumns)
    .execute()

  // ws_disposal_transactions
  await db.schema
    .alterTable("ws_disposal_transactions")
    .addColumn("disposal_instruction_id", "integer")
    .execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .dropTable("ws_disposal_instruction_comments")
    .ifExists()
    .execute()
  await db.schema.dropTable("ws_disposal_instructions").ifExists().execute()
  await db.schema
    .alterTable("ws_disposal_transactions")
    .dropColumn("disposal_instruction_id")
    .execute()
}
