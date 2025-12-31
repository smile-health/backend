/* eslint-disable @typescript-eslint/no-explicit-any */
import { insertTableMapping } from "@/scripts/helper.js"
import { Kysely, Transaction } from "kysely"
import { db } from "../../../db.platform.js"
import { MigrationDB } from "../../../types.js"
import { DB } from "../../../types.platform.js"

export const migrateStockExterminations = async (
  trx: Transaction<DB>,
  migrationDB: Kysely<MigrationDB>,
  programId: number,
  stockIds: number[],
  mapGlobalIds = {}
) => {
  const stockExterminations = await migrationDB
    .selectFrom("stock_exterminations as se")
    .select([
      "se.id",
      "se.stock_id",
      "se.transaction_reason_id",
      "se.extermination_discard_qty",
      "se.extermination_received_qty",
      "se.createdAt",
      "se.created_by",
      "se.updatedAt",
      "se.updated_by",
    ])
    .where("se.stock_id", "in", stockIds)
    .execute()

  if (stockExterminations.length === 0) {
    return
  }

  const res = await db
    .insertInto("ws_stock_exterminations")
    .values(
      stockExterminations.map((stockExtermination) => ({
        stock_id: mapGlobalIds[stockExtermination.stock_id ?? 0],
        transaction_reason_id: stockExtermination.transaction_reason_id,
        extermination_discard_qty: stockExtermination.extermination_discard_qty,
        extermination_received_qty:
          stockExtermination.extermination_received_qty,
        created_at: stockExtermination.createdAt,
        updated_at: stockExtermination.updatedAt,
      }))
    )
    .executeTakeFirst()

  const insertedIds = Array.from(
    { length: stockIds.length },
    (_, i) => Number(res.insertId) + i
  )
  const mapStockExterminationIds = {}
  for (const [i, stockExtermination] of stockExterminations.entries()) {
    mapStockExterminationIds[stockExtermination.id] = insertedIds[i]
  }

  await insertTableMapping(
    "stock_exterminations",
    programId,
    mapStockExterminationIds
  )
}
