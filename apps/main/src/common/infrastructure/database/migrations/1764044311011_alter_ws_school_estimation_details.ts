import { Kysely, sql } from "kysely"

export async function up(db: Kysely<any>): Promise<void> {
  const dropForeignKeyQuery = sql`
		ALTER TABLE ws_school_estimation_details
		DROP FOREIGN KEY ws_school_estimation_details_school_id_fk
	`
  await db.executeQuery(dropForeignKeyQuery.compile(db))

  const alterColumnQuery = sql`
		ALTER TABLE ws_school_estimation_details
		MODIFY COLUMN school_id BIGINT NULL
	`
  await db.executeQuery(alterColumnQuery.compile(db))
}

export async function down(db: Kysely<any>): Promise<void> {
  const alterColumnQuery = sql`
		ALTER TABLE ws_school_estimation_details
		MODIFY COLUMN school_id BIGINT NOT NULL
	`
  await db.executeQuery(alterColumnQuery.compile(db))

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
