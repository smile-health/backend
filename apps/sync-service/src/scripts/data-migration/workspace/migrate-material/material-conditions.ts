/* eslint-disable @typescript-eslint/no-explicit-any */
import { Kysely, Transaction } from "kysely"
import { MigrationDB } from "../../../types.js"
import { DB } from "../../../types.platform.js"

const TRANSACTION_TYPE = {
  STOCK_COUNT: 1,
  ISSUES: 2,
  RECEIPTS: 3,
  DISCARDS: 4,
  RETURN: 5,
  RECEIPT_OPEN_VIAL: 6,
  ADD_STOCK: 7,
  REMOVE_STOCK: 8,
  CANCEL_DISCARD: 9,
}

export const migrateMaterialConditions = async (
  trx: Transaction<DB>,
  migrationDB: Kysely<MigrationDB>,
  materialIds: number[],
  mapGlobalIds = {}
) => {
  // migrating addremove
  const conditions = await migrationDB
    .selectFrom("master_material_has_conditions as mc")
    .selectAll()
    .where("master_material_id", "in", materialIds)
    .where("type", "=", TRANSACTION_TYPE.ADD_STOCK)
    .execute()

  if (conditions.length === 0) {
    return
  }

  await trx
    .insertInto("ws_material_permissions")
    .values(
      conditions.map((condition) => ({
        material_id: mapGlobalIds[condition.master_material_id ?? 0] ?? 0,
        action: condition.type ?? TRANSACTION_TYPE.ADD_STOCK,
        key: condition.key ?? "",
        value: Number(condition.value),
      }))
    )
    .executeTakeFirst()
}
