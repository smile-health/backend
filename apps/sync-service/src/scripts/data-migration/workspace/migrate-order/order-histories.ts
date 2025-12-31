import { collect } from "@smile/lib/utils.js"
import { Kysely, Transaction } from "kysely"
import { getMapUserIds, insertTableMapping } from "../../../helper.js"
import { MigrationDB } from "../../../types.js"
import { DB } from "../../../types.platform.js"

export const migrateOrderHistories = async (
  trx: Transaction<DB>,
  migrationDB: Kysely<MigrationDB>,
  programId: number,
  orderIds: number[],
  mapPlatformOrderIds = {}
) => {
  const histories = await migrationDB
    .selectFrom("order_histories as h")
    .selectAll("h")
    .where("order_id", "in", orderIds)
    .execute()

  if (histories.length === 0) {
    return
  }

  const orderHistoryIds = collect(histories, "id")

  const mapUserIds = await getMapUserIds(
    programId,
    collect(histories, "updated_by")
  )

  const res = await trx
    .insertInto("ws_order_histories")
    .values(
      histories.map((history) => ({
        order_id: mapPlatformOrderIds[history.order_id ?? 0],
        order_status_id: history.status ?? 0,
        updated_by: mapUserIds[history.updated_by ?? 0],
        created_at: history.created_at,
        updated_at: history.updated_at,
      }))
    )
    .executeTakeFirst()

  const insertedIds = Array.from(
    { length: orderHistoryIds.length },
    (_, i) => Number(res.insertId) + i
  )
  const mapPlatformOrderHistoryIds = {}
  for (const [i, history] of histories.entries()) {
    mapPlatformOrderHistoryIds[history.id] = insertedIds[i]
  }

  await insertTableMapping(
    "order_histories",
    programId,
    mapPlatformOrderHistoryIds
  )
}
