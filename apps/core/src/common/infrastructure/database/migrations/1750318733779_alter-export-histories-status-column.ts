import { Kysely, sql } from "kysely"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await sql`
    ALTER TABLE export_histories 
    MODIFY COLUMN status ENUM('in_queue', 'in_progress', 'done', 'failed') NOT NULL DEFAULT 'in_queue'
  `.execute(db)
}

export async function down(db: Kysely<Database>): Promise<void> {
  await sql`
    ALTER TABLE export_histories 
    MODIFY COLUMN status ENUM('in_queue', 'in_progress', 'done', 'failed') NOT NULL DEFAULT 'in_queue'
  `.execute(db)
}
