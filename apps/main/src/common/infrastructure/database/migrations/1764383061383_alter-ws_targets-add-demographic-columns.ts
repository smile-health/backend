import type { Kysely } from "kysely"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .alterTable("ws_targets")
    .addColumn("name", "varchar(255)")
    .addColumn("marital_status", "integer")
    .addColumn("education_id", "bigint")
    .addColumn("occupation_id", "bigint")
    .addColumn("religion_id", "bigint")
    .addColumn("ethnic_id", "bigint")
    .addColumn("residence_address", "varchar(255)")
    .addColumn("registered_address", "varchar(255)")
    .addColumn("phone_number", "varchar(255)")
    .addColumn("identity_type", "integer")
    .execute()

  await db.schema
    .alterTable("ws_targets")
    .addForeignKeyConstraint(
      "ws_targets_education_id_fk",
      ["education_id"],
      "educations",
      ["id"]
    )
    .onDelete("cascade")
    .onUpdate("cascade")
    .execute()

  await db.schema
    .alterTable("ws_targets")
    .addForeignKeyConstraint(
      "ws_targets_occupation_id_fk",
      ["occupation_id"],
      "occupations",
      ["id"]
    )
    .onDelete("cascade")
    .onUpdate("cascade")
    .execute()

  await db.schema
    .alterTable("ws_targets")
    .addForeignKeyConstraint(
      "ws_targets_religion_id_fk",
      ["religion_id"],
      "religions",
      ["id"]
    )
    .onDelete("cascade")
    .onUpdate("cascade")
    .execute()

  await db.schema
    .alterTable("ws_targets")
    .addForeignKeyConstraint(
      "ws_targets_ethnic_id_fk",
      ["ethnic_id"],
      "ethnics",
      ["id"]
    )
    .onDelete("cascade")
    .onUpdate("cascade")
    .execute()

  await db.schema
    .alterTable("ws_targets")
    .addForeignKeyConstraint(
      "ws_targets_microplanning_id_fk",
      ["microplanning_id"],
      "ws_microplanning",
      ["id"]
    )
    .onDelete("cascade")
    .onUpdate("cascade")
    .execute()

  await db.schema
    .createIndex("ws_targets_education_id_idx")
    .on("ws_targets")
    .column("education_id")
    .execute()

  await db.schema
    .createIndex("ws_targets_occupation_id_idx")
    .on("ws_targets")
    .column("occupation_id")
    .execute()

  await db.schema
    .createIndex("ws_targets_religion_id_idx")
    .on("ws_targets")
    .column("religion_id")
    .execute()

  await db.schema
    .createIndex("ws_targets_ethnic_id_idx")
    .on("ws_targets")
    .column("ethnic_id")
    .execute()

  await db.schema
    .createIndex("ws_targets_marital_status_idx")
    .on("ws_targets")
    .column("marital_status")
    .execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema
    .alterTable("ws_targets")
    .dropConstraint("ws_targets_microplanning_id_fk")
    .execute()

  await db.schema
    .alterTable("ws_targets")
    .dropConstraint("ws_targets_education_id_fk")
    .execute()

  await db.schema
    .alterTable("ws_targets")
    .dropConstraint("ws_targets_occupation_id_fk")
    .execute()

  await db.schema
    .alterTable("ws_targets")
    .dropConstraint("ws_targets_religion_id_fk")
    .execute()

  await db.schema
    .alterTable("ws_targets")
    .dropConstraint("ws_targets_ethnic_id_fk")
    .execute()

  await db.schema
    .alterTable("ws_targets")
    .dropColumn("name")
    .dropColumn("marital_status")
    .dropColumn("education_id")
    .dropColumn("occupation_id")
    .dropColumn("religion_id")
    .dropColumn("ethnic_id")
    .dropColumn("residence_address")
    .dropColumn("registered_address")
    .dropColumn("phone_number")
    .dropColumn("identity_type")
    .execute()
}
