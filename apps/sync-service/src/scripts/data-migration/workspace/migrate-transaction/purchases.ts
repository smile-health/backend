import { collect } from "@smile-health/lib/utils.js"
import { Kysely, Transaction } from "kysely"
import { getMapBudgetSourceIds } from "../../../helper.js"
import { MigrationDB } from "../../../types.js"
import { DB } from "../../../types.platform.js"

export const migratePurchases = async (
  trx: Transaction<DB>,
  migrationDB: Kysely<MigrationDB>,
  programId: number,
  trxIds: number[],
  mapGlobalIds = {}
) => {
  // get old data purchases
  const purchases = await migrationDB
    .selectFrom("transaction_purchase as tp")
    .innerJoin("transactions as t", "t.id", "tp.transaction_id")
    .selectAll("tp")
    .select(["t.created_by", "t.updated_by"])
    .where("tp.deleted_at", "is", null)
    .where("t.id", "in", trxIds)
    .execute()

  if (purchases.length === 0) {
    return
  }

  const mapBudgetSourceIds = await getMapBudgetSourceIds(
    programId,
    collect(purchases, "source_material_id")
  )

  // insert purchases to new table
  await trx
    .insertInto("ws_purchases")
    .values(
      purchases.map((val) => ({
        source_id: mapGlobalIds[val.transaction_id ?? 0],
        source_type: "transaction",
        budget_source_id: mapBudgetSourceIds[val.source_material_id ?? 0],
        year: val.year,
        price: val.price,
        total_price: val.total_price,
        created_at: val.created_at,
        updated_at: val.updated_at,
        deleted_at: val.deleted_at,
        created_by: val.created_by,
        updated_by: val.updated_by,
      }))
    )
    .executeTakeFirst()
}
