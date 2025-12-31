import type { Kysely } from "kysely"
import { addAuditColumns, addTimestampColumns } from "../helper.js"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .createTable("ws_school_estimation_details")
    .addColumn("id", "bigint", (col) => col.autoIncrement().primaryKey())
    .addColumn("estimation_id", "bigint", (col) => col.notNull())
    .addColumn("school_id", "bigint", (col) => col.notNull())
    .addColumn("schedule_month", "varchar(255)")
    .addColumn("required_service", "integer", (col) => col.defaultTo(0))
    .addColumn("required_service_days", "integer", (col) => col.defaultTo(0))
    .addColumn("available_vaccinator", "integer", (col) => col.defaultTo(0))
    .addColumn("notes", "text", (col) => col.defaultTo(""))
    .$call(addTimestampColumns)
    .$call(addAuditColumns)
    .execute()

  await db.schema
    .createIndex("ws_school_estimation_details_estimation_id_idx")
    .on("ws_school_estimation_details")
    .column("estimation_id")
    .execute()

  await db.schema
    .createIndex("ws_school_estimation_details_school_id_idx")
    .on("ws_school_estimation_details")
    .column("school_id")
    .execute()

  await db.schema
    .alterTable("ws_school_estimation_details")
    .addForeignKeyConstraint(
      "ws_school_estimation_details_estimation_id_fk",
      ["estimation_id"],
      "ws_target_estimations",
      ["id"]
    )
    .onDelete("cascade")
    .execute()

  await db.schema
    .alterTable("ws_school_estimation_details")
    .addForeignKeyConstraint(
      "ws_school_estimation_details_school_id_fk",
      ["school_id"],
      "entities",
      ["id"]
    )
    .onDelete("cascade")
    .execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.dropTable("ws_school_estimation_details")
}
