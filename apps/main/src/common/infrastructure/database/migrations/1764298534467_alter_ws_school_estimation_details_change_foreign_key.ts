import type { Kysely } from "kysely"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .alterTable("ws_school_estimation_details")
    .dropConstraint("ws_school_estimation_details_estimation_id_fk")
    .execute()

  await db.schema
    .alterTable("ws_school_estimation_details")
    .dropColumn("estimation_id")
    .execute()

  await db.schema
    .alterTable("ws_school_estimation_details")
    .addColumn("microplanning_id", "bigint", (col) => col.notNull())
    .addColumn("status", "int2", (col) => col.defaultTo(0))
    .execute()

  await db.schema
    .alterTable("ws_school_estimation_details")
    .addForeignKeyConstraint(
      "ws_school_estimation_details_microplanning_id_fk",
      ["microplanning_id"],
      "ws_microplanning",
      ["id"]
    )
    .onDelete("cascade")
    .execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema
    .alterTable("ws_school_estimation_details")
    .dropConstraint("ws_school_estimation_details_microplanning_id_fk")
    .execute()

  await db.schema
    .alterTable("ws_school_estimation_details")
    .dropColumn("microplanning_id")
    .dropColumn("status")
    .execute()

  await db.schema
    .alterTable("ws_school_estimation_details")
    .addColumn("estimation_id", "bigint", (col) => col.notNull())
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
}
