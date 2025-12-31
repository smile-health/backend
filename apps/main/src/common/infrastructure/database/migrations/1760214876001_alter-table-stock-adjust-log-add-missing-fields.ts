import { Kysely, sql } from "kysely"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  // MySQL specific ALTER TABLE statements
  const alterTableQuery = sql`
    ALTER TABLE stock_adjust_log 
    ADD COLUMN transaction_id_add BIGINT,
    ADD COLUMN stock_id_malaria BIGINT,
    ADD COLUMN batch_id_malaria BIGINT,
    ADD COLUMN material_id_malaria BIGINT,
    ADD COLUMN entity_id_malaria BIGINT,
    ADD COLUMN manufacture_id_malaria BIGINT,
    ADD COLUMN qty_malaria DECIMAL(15,4),
    ADD COLUMN budget_source_id_malaria BIGINT,
    ADD COLUMN exterminate_qty_malaria DECIMAL(15,4),
    ADD COLUMN open_vial_qty_malaria DECIMAL(15,4),
    ADD COLUMN year_malaria INT,
    ADD COLUMN price_malaria DECIMAL(15,4),
    ADD COLUMN total_price_malaria DECIMAL(15,4),
    MODIFY COLUMN transaction_id_remove BIGINT,
    CHANGE COLUMN execution_status status ENUM('success', 'failed', 'skipped') NOT NULL DEFAULT 'success',
    DROP COLUMN process_execution_time
  `
  await db.executeQuery(alterTableQuery.compile(db))

  // Add indexes for new columns
  await db.schema
    .createIndex("idx_stock_adjust_log_transaction_id_remove")
    .on("stock_adjust_log")
    .column("transaction_id_remove")
    .execute()

  await db.schema
    .createIndex("idx_stock_adjust_log_transaction_id_add")
    .on("stock_adjust_log")
    .column("transaction_id_add")
    .execute()

  await db.schema
    .createIndex("idx_stock_adjust_log_stock_id_malaria")
    .on("stock_adjust_log")
    .column("stock_id_malaria")
    .execute()

  await db.schema
    .createIndex("idx_stock_adjust_log_material_id_malaria")
    .on("stock_adjust_log")
    .column("material_id_malaria")
    .execute()

  await db.schema
    .createIndex("idx_stock_adjust_log_entity_id_malaria")
    .on("stock_adjust_log")
    .column("entity_id_malaria")
    .execute()

  await db.schema
    .createIndex("idx_stock_adjust_log_status")
    .on("stock_adjust_log")
    .column("status")
    .execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  // Drop added indexes
  await db.schema
    .dropIndex("idx_stock_adjust_log_transaction_id_remove")
    .execute()
  await db.schema.dropIndex("idx_stock_adjust_log_transaction_id_add").execute()
  await db.schema.dropIndex("idx_stock_adjust_log_stock_id_malaria").execute()
  await db.schema
    .dropIndex("idx_stock_adjust_log_material_id_malaria")
    .execute()
  await db.schema.dropIndex("idx_stock_adjust_log_entity_id_malaria").execute()
  await db.schema.dropIndex("idx_stock_adjust_log_status").execute()

  // MySQL specific ALTER TABLE to revert all changes
  const revertTableQuery = sql`
    ALTER TABLE stock_adjust_log 
    MODIFY COLUMN transaction_id_remove VARCHAR(255),
    CHANGE COLUMN status execution_status ENUM('success', 'failed', 'skipped') NOT NULL DEFAULT 'success',
    ADD COLUMN process_execution_time INT COMMENT 'Execution time in milliseconds',
    DROP COLUMN transaction_id_add,
    DROP COLUMN stock_id_malaria,
    DROP COLUMN batch_id_malaria,
    DROP COLUMN material_id_malaria,
    DROP COLUMN entity_id_malaria,
    DROP COLUMN manufacture_id_malaria,
    DROP COLUMN qty_malaria,
    DROP COLUMN budget_source_id_malaria,
    DROP COLUMN exterminate_qty_malaria,
    DROP COLUMN open_vial_qty_malaria,
    DROP COLUMN year_malaria,
    DROP COLUMN price_malaria,
    DROP COLUMN total_price_malaria
  `
  await db.executeQuery(revertTableQuery.compile(db))
}
