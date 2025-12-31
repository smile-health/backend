import type { Kysely } from "kysely"
import { addAuditColumns, addTimestampColumns } from "../helper.js"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .createTable("ws_village_estimation_details")
    .addColumn("id", "bigint", (col) => col.autoIncrement().primaryKey())
    .addColumn("estimation_id", "bigint", (col) => col.notNull())
    .addColumn("village_id", "bigint", (col) => col.notNull().unique())
    .addColumn("outreach_service_percentage", "decimal(5, 2)", (col) =>
      col.defaultTo(0)
    )
    .addColumn("facility_service_percentage", "decimal(5, 2)", (col) =>
      col.defaultTo(0)
    )
    .addColumn("required_monthly_outreach_service", "integer", (col) =>
      col.defaultTo(0)
    )
    .addColumn("required_monthly_facility_service", "integer", (col) =>
      col.defaultTo(0)
    )
    .addColumn("available_outreach_service", "integer", (col) =>
      col.defaultTo(0)
    )
    .addColumn("avalable_facillity_service", "integer", (col) =>
      col.defaultTo(0)
    )
    .addColumn("additional_outreach_service", "integer", (col) =>
      col.defaultTo(0)
    )
    .addColumn("additional_outreach_vaccinator_service", "integer", (col) =>
      col.defaultTo(0)
    )
    .addColumn("additional_facility_service", "integer", (col) =>
      col.defaultTo(0)
    )
    .addColumn("additional_facility_vaccinator_service", "integer", (col) =>
      col.defaultTo(0)
    )
    .addColumn("health_worker_ideal_needs", "integer", (col) =>
      col.defaultTo(0)
    )
    .addColumn("available_worker", "integer", (col) => col.defaultTo(0))
    .addColumn("gap_health_worker", "integer", (col) => col.defaultTo(0))
    .addColumn("notes", "text", (col) => col.defaultTo(""))
    .$call(addTimestampColumns)
    .$call(addAuditColumns)
    .execute()

  await db.schema
    .createIndex("ws_village_estimation_details_estimation_id_idx")
    .on("ws_village_estimation_details")
    .column("estimation_id")
    .execute()

  await db.schema
    .createIndex("ws_village_estimation_details_village_id_idx")
    .on("ws_village_estimation_details")
    .column("village_id")
    .execute()

  await db.schema
    .alterTable("ws_village_estimation_details")
    .addForeignKeyConstraint(
      "ws_village_estimation_details_estimation_id_fk",
      ["estimation_id"],
      "ws_target_estimations",
      ["id"]
    )
    .onDelete("cascade")
    .execute()

  await db.schema
    .alterTable("ws_village_estimation_details")
    .addForeignKeyConstraint(
      "ws_village_estimation_details_village_id_fk",
      ["village_id"],
      "locations",
      ["id"]
    )
    .onDelete("cascade")
    .execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.dropTable("ws_village_estimation_details")
}
