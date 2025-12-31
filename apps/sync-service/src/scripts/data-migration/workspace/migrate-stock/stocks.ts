import { collect, merge } from "@smile/lib/utils.js"
import { Kysely, Transaction } from "kysely"
import {
  getMapActivityIds,
  getMapBatchIds,
  getMapBudgetSourceIds,
  getMapEntityIds,
  getMapManufactureIds,
  getMapMaterialIds,
  insertTableMapping,
} from "../../../helper.js"
import { MigrationDB } from "../../../types.js"
import { DB } from "../../../types.platform.js"

export const migrateStocks = async (
  trx: Transaction<DB>,
  migrationDB: Kysely<MigrationDB>,
  programId: number,
  stockIds: number[]
) => {
  const stocks = await migrationDB
    .selectFrom("stocks as s")
    .innerJoin(
      "entity_has_master_materials as em",
      "em.id",
      "s.entity_has_material_id"
    )
    .innerJoin("master_materials as m", "m.id", "em.master_material_id")
    .leftJoin("batches as b", "b.id", "s.batch_id")
    .select([
      "s.id",
      "s.batch_id",
      "s.qty",
      "s.allocated",
      "s.in_transit",
      "s.extermination_qty",
      "s.open_vial",
      "s.status",
      "s.budget_source",
      "em.master_material_id",
      "em.entity_id",
      "activity_id",
      "m.parent_id",
      "b.code as batch_code",
      "b.manufacture_id",
    ])
    .where("s.id", "in", stockIds)
    .execute()

  const materialIds = merge(
    collect(stocks, "master_material_id"),
    collect(stocks, "parent_id")
  )
  const [
    mapEntityIds,
    mapMaterialIds,
    mapActivityIds,
    mapBatchIds,
    mapManufactureIds,
    budgetSourceIds,
  ] = await Promise.all([
    getMapEntityIds(programId, collect(stocks, "entity_id")),
    getMapMaterialIds(programId, materialIds),
    getMapActivityIds(programId, collect(stocks, "activity_id")),
    getMapBatchIds(programId, collect(stocks, "batch_id")),
    getMapManufactureIds(programId, collect(stocks, "manufacture_id")),
    getMapBudgetSourceIds(programId, collect(stocks, "budget_source")),
  ])

  const res = await trx
    .insertInto("ws_stocks")
    .values(
      stocks.map((stock) => ({
        batch_id: mapBatchIds[stock.batch_id ?? 0],
        entity_id: mapEntityIds[stock.entity_id ?? 0] ?? 0,
        material_id: mapMaterialIds[stock.master_material_id ?? 0] ?? 0,
        parent_material_id: mapMaterialIds[stock.parent_id ?? 0],
        activity_id: mapActivityIds[stock.activity_id ?? 0] ?? 0,
        budget_source_id: budgetSourceIds[stock.budget_source ?? 0],
        qty: stock.qty ?? 0,
        allocated_qty: stock.allocated,
        in_transit_qty: stock.in_transit ?? 0,
        open_vial_qty: stock.open_vial,
        exterminated_qty: stock.extermination_qty,
        stock_quality_id: stock.status,
        batch_code: stock.batch_code,
        // manufacture_id: mapManufactureIds[stock.manufacture_id ?? 0] ?? null,
      }))
    )
    .executeTakeFirst()

  const insertedIds = Array.from(
    { length: stocks.length },
    (_, i) => Number(res.insertId) + i
  )
  const mapGlobalIds = {}
  for (const [i, stock] of stocks.entries()) {
    mapGlobalIds[stock.id] = insertedIds[i]
  }
  await insertTableMapping("stocks", programId, mapGlobalIds)

  return mapGlobalIds
}
