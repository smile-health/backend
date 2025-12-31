import { Kysely } from "kysely"
import { DB } from "../types/db.js"

export async function up(db: Kysely<DB>): Promise<void> {
  // High priority index for stocks/entities/sort endpoint
  // This matches the query pattern: JOIN ws_stocks with ws_materials on parent_material_id
  // and filters by entity_id
  
  await db.schema
    .createIndex("idx_ws_stocks_entity_parent_material")
    .on("ws_stocks")
    .columns(["entity_id", "parent_material_id"])
    .execute()

  await db.schema
    .createIndex("idx_ws_stock_opname_periods_program_status_year")
    .on("ws_stock_opname_periods")
    .columns(["program_id", "status", "year_period", "month_period"])
    .execute()
}

export async function down(db: Kysely<DB>): Promise<void> {
  await db.schema.dropIndex("idx_ws_stocks_entity_parent_material").execute()
  await db.schema.dropIndex("idx_ws_stock_opname_periods_program_status_year").execute()
}
