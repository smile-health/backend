import type { Kysely } from "kysely"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
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
    .alterColumn("marital_status", (col) => col.setDefault(0))
    .execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema
    .alterTable("ws_targets")
    .alterColumn("marital_status", (col) => col.dropDefault())
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
}
