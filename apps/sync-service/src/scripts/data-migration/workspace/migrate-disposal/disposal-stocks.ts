import { collect } from "@smile-health/lib/utils.js"
import { Kysely, Transaction } from "kysely"
import { getMapStockIds, insertTableMapping } from "../../../helper.js"
import { MigrationDB } from "../../../types.js"
import { DB } from "../../../types.platform.js"

export const migrateDisposalStocks = async (
  trx: Transaction<DB>,
  migrationDB: Kysely<MigrationDB>,
  programId: number,
  stockExterminationIds: number[]
) => {
  // Get disposal stocks from stock_exterminations
  const stockExterminations = await migrationDB
    .selectFrom("stock_exterminations as se")
    .select([
      "se.id",
      "se.stock_id",
      "se.transaction_reason_id",
      "se.extermination_discard_qty",
      "se.extermination_received_qty",
      "se.extermination_qty",
      "se.extermination_shipped_qty",
      "se.createdAt",
      "se.updatedAt",
    ])
    .where("se.id", "in", stockExterminationIds)
    .execute()

  if (stockExterminations.length === 0) {
    console.log("No disposal stocks to migrate")
    return
  }

  console.log(`Migrating ${stockExterminations.length} disposal stocks`)

  // Get mapping for stock IDs
  const mapStockIds = await getMapStockIds(
    programId,
    collect(stockExterminations, "stock_id")
  )

  // Filter out records where we don't have mapped stock IDs
  const validStockExterminations = stockExterminations.filter(
    (se) => mapStockIds[se.stock_id ?? 0] !== undefined
  )

  if (validStockExterminations.length === 0) {
    console.log("No valid disposal stocks to migrate (missing stock mappings)")
    return
  }

  const res = await trx
    .insertInto("ws_disposal_stocks")
    .values(
      validStockExterminations.map((se) => {
        return {
          stock_id: mapStockIds[se.stock_id ?? 0] ?? 0,
          transaction_reason_id: se.transaction_reason_id ?? 0,
          disposal_discard_qty: se.extermination_discard_qty ?? 0,
          disposal_received_qty: se.extermination_received_qty ?? 0,
          disposal_qty: se.extermination_qty ?? 0,
          disposal_shipped_qty: se.extermination_shipped_qty ?? 0,
          created_at: se.createdAt ?? new Date(),
          updated_at: se.updatedAt ?? new Date(),
        }
      })
    )
    .executeTakeFirst()

  const insertedIds = Array.from(
    { length: validStockExterminations.length },
    (_, i) => Number(res.insertId) + i
  )

  const mapGlobalIds = {}
  for (const [i, se] of validStockExterminations.entries()) {
    mapGlobalIds[se.id] = insertedIds[i]
  }

  await insertTableMapping("stock_exterminations", programId, mapGlobalIds)

  console.log(
    `Successfully migrated ${validStockExterminations.length} disposal stocks`
  )
  return mapGlobalIds
}
