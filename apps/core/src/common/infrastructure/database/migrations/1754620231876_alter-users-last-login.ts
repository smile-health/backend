import { Kysely, sql } from "kysely"
import { Database } from "../types"

export async function up(db: Kysely<Database>): Promise<void> {
  await sql`
  ALTER TABLE users
  MODIFY COLUMN last_login TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
`.execute(db)

}

export async function down(db: Kysely<Database>): Promise<void> {
  await sql`ALTER TABLE users MODIFY COLUMN last_login DATETIME`.execute(db)
}
