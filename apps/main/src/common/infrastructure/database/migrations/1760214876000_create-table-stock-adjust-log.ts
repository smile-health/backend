import { Kysely, sql } from "kysely"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  const createTableQuery = sql`
    CREATE TABLE stock_adjust_log (
      transaction_id_remove VARCHAR(255),
      stock_id_mbs BIGINT,
      batch_id_mbs BIGINT,
      material_id_mbs BIGINT,
      entity_id_mbs BIGINT,
      manufacture_id_mbs BIGINT,
      qty_mbs DECIMAL(15,4),
      budget_source_id_mbs BIGINT,
      exterminate_qty_mbs DECIMAL(15,4),
      open_vial_qty_mbs DECIMAL(15,4),
      year_mbs INT,
      price_mbs DECIMAL(15,4),
      total_price_mbs DECIMAL(15,4),
      execution_status ENUM('success', 'failed', 'skipped') NOT NULL DEFAULT 'success',
      process_execution_time INT COMMENT 'Execution time in milliseconds',
      message TEXT
    )
  `
  await db.executeQuery(createTableQuery.compile(db))

  // Add indexes for better performance
  await db.schema
    .createIndex("idx_stock_adjust_log_stock_id_mbs")
    .on("stock_adjust_log")
    .column("stock_id_mbs")
    .execute()

  await db.schema
    .createIndex("idx_stock_adjust_log_material_id_mbs")
    .on("stock_adjust_log")
    .column("material_id_mbs")
    .execute()

  await db.schema
    .createIndex("idx_stock_adjust_log_entity_id_mbs")
    .on("stock_adjust_log")
    .column("entity_id_mbs")
    .execute()

  await db.schema
    .createIndex("idx_stock_adjust_log_execution_status")
    .on("stock_adjust_log")
    .column("execution_status")
    .execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.dropTable("stock_adjust_log").execute()
}
