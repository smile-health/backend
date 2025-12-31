import { Kysely, sql } from "kysely"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  // Alter ENUM value from 'success' to 'done' in status column
  await sql`
    ALTER TABLE export_histories 
    MODIFY COLUMN status ENUM('in_queue', 'in_progress', 'done', 'failed')
  `.execute(db)

  // Add program_id column after id
  await db.schema
    .alterTable("export_histories")
    .addColumn("program_id", sql`integer AFTER id`)
    .execute()

  // Add download_url column after status column
  await db.schema
    .alterTable("export_histories")
    .addColumn("download_url", sql`varchar(255) AFTER status`)
    .execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  // Revert ENUM value from 'done' to 'success' in status column
  await sql`
    ALTER TABLE export_histories 
    MODIFY COLUMN status ENUM('in_queue', 'in_progress', 'success', 'failed')
  `.execute(db)

  // Remove program_id column
  await db.schema
    .alterTable("export_histories")
    .dropColumn("program_id")
    .execute()

  // Remove download_url column
  await db.schema
    .alterTable("export_histories")
    .dropColumn("download_url")
    .execute()
}
