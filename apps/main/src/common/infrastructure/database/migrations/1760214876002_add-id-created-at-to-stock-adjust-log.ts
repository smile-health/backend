import { Kysely, sql } from "kysely"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  // Add id as auto-increment primary key and created_at timestamp
  const alterTableQuery = sql`
    ALTER TABLE stock_adjust_log 
    ADD COLUMN id BIGINT AUTO_INCREMENT PRIMARY KEY FIRST,
    ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  `
  await db.executeQuery(alterTableQuery.compile(db))

  // Add index for created_at for better query performance
  await db.schema
    .createIndex("idx_stock_adjust_log_created_at")
    .on("stock_adjust_log")
    .column("created_at")
    .execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  // Drop the created_at index
  await db.schema.dropIndex("idx_stock_adjust_log_created_at").execute()

  // Remove id primary key and created_at column
  const revertTableQuery = sql`
    ALTER TABLE stock_adjust_log 
    DROP PRIMARY KEY,
    DROP COLUMN id,
    DROP COLUMN created_at
  `
  await db.executeQuery(revertTableQuery.compile(db))
}
