import type { Kysely } from "kysely"
import { sql } from "kysely"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema.alterTable("ws_patients").dropColumn("birth_date").execute()

  await sql`ALTER TABLE ws_patients RENAME COLUMN enc_birth_date TO birth_date`.execute(
    db
  )

  await sql`ALTER TABLE ws_patients MODIFY COLUMN birth_date VARCHAR(255) AFTER gender`.execute(
    db
  )
}

export async function down(db: Kysely<Database>): Promise<void> {
  await sql`ALTER TABLE ws_patients MODIFY COLUMN birth_date VARCHAR(255) AFTER name`.execute(
    db
  )

  await sql`ALTER TABLE ws_patients RENAME COLUMN birth_date TO enc_birth_date`.execute(
    db
  )

  await db.schema
    .alterTable("ws_patients")
    .addColumn("birth_date", "date", (col) => col)
    .execute()
}
