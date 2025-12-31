import { db } from "@/common/infrastructure/database/index.js"
import { collect } from "@smile/lib/utils.js"
import { Kysely, Transaction } from "kysely"
import { insertTableMapping } from "../../../helper.js"
import {
  getMapActivityIds,
  getMapEntityIds,
  getMapMaterialIds,
  getMapUserIds,
  getPlatformProgramIdByPlatformActivityId,
} from "./utils/disposal.helpers.js"
import { MigrationDB } from "../../../types.js"
import { DB } from "../../../types.platform.js"

export const migrateDisposalTransactions = async (
  trx: Transaction<DB>,
  migrationDB: Kysely<MigrationDB>,
  programIds: number[],
  exterminationTransactions
) => {
  if (exterminationTransactions.length === 0) {
    console.log("No disposal transactions to migrate")
    return
  }
  const numberOfDocumentFromOrders = await migrationDB
    .selectFrom("orders as o")
    .select(["o.id", "o.no_document"])
    .where("o.deleted_at", "is", null)
    .where("o.id", "in", collect(exterminationTransactions, "order_id"))
    .execute()

  const orderComments = await migrationDB
    .selectFrom("order_comments as oc")
    .select(["oc.order_id", "oc.comment"])
    .where("oc.deleted_at", "is", null)
    .where("oc.order_id", "in", collect(exterminationTransactions, "order_id"))
    .execute()

  console.log(
    `Migrating ${exterminationTransactions.length} disposal transactions`
  )

  // Get all necessary mappings
  const [mapMaterialIds, mapActivityIds, mapEntityIds, mapUserIds] =
    await Promise.all([
      getMapMaterialIds(
        programIds,
        collect(exterminationTransactions, "master_material_id")?.filter(
          (item, index) =>
            collect(exterminationTransactions, "master_material_id").indexOf(
              item
            ) === index
        )
      ),
      getMapActivityIds(
        programIds,
        collect(exterminationTransactions, "activity_id")?.filter(
          (item, index) =>
            collect(exterminationTransactions, "activity_id").indexOf(item) ===
            index
        )
      ),
      getMapEntityIds(
        programIds,
        collect(exterminationTransactions, "entity_id")?.filter(
          (item, index) =>
            collect(exterminationTransactions, "entity_id").indexOf(item) ===
            index
        )
      ),
      getMapUserIds(
        programIds,
        collect(exterminationTransactions, "created_by", "updated_by")?.filter(
          (item, index) =>
            collect(
              exterminationTransactions,
              "created_by",
              "updated_by"
            ).indexOf(item) === index
        )
      ),
    ])

  // Get disposal transaction type mappings
  const transactionTypeIds = collect(
    exterminationTransactions,
    "extermination_transaction_type_id"
  )
  const mapDisposalTransactionTypeIds =
    transactionTypeIds.length > 0
      ? await db
          .selectFrom("mapping_extermination_transaction_types as mett")
          .select([
            "mett.platform_extermination_transaction_type_id",
            "mett.existing_extermination_transaction_type_id",
          ])
          .where("mett.program_id", "in", programIds)
          .where(
            "mett.existing_extermination_transaction_type_id",
            "in",
            transactionTypeIds
          )
          .execute()
          .then((rows) => {
            const result = {}
            for (const row of rows) {
              result[row.existing_extermination_transaction_type_id] =
                row.platform_extermination_transaction_type_id
            }
            return result
          })
      : {}

  // Get disposal method mappings
  const flowIds = collect(exterminationTransactions, "flow_id")
  const mapDisposalMethodIds =
    flowIds.length > 0
      ? await db
          .selectFrom("mapping_extermination_flows as mef")
          .select([
            "mef.platform_extermination_flow_id",
            "mef.existing_extermination_flow_id",
          ])
          .where("mef.program_id", "in", programIds)
          .where("mef.existing_extermination_flow_id", "in", flowIds)
          .execute()
          .then((rows) => {
            const result = {}
            for (const row of rows) {
              result[row.existing_extermination_flow_id] =
                row.platform_extermination_flow_id
            }
            return result
          })
      : {}

  const stockDisposalIds = collect(
    exterminationTransactions,
    "stock_extermination_id"
  )
  const mapDisposalStockIds =
    stockDisposalIds.length > 0
      ? await db
          .selectFrom("mapping_stock_exterminations as mse")
          .select([
            "mse.platform_stock_extermination_id",
            "mse.existing_stock_extermination_id",
          ])
          .where("mse.program_id", "in", programIds)
          .where("mse.existing_stock_extermination_id", "in", stockDisposalIds)
          .execute()
          .then((rows) => {
            const result = {}
            for (const row of rows) {
              result[row.existing_stock_extermination_id] =
                row.platform_stock_extermination_id
            }
            return result
          })
      : {}

  const res = await trx
    .insertInto("ws_disposal_transactions")
    .values(
      exterminationTransactions.map((et) => {
        // Calculate closing_qty as per the virtual attribute logic
        return {
          disposal_transaction_type_id:
            mapDisposalTransactionTypeIds[
              et.extermination_transaction_type_id ?? 0
            ] ?? null,
          disposal_method_id: mapDisposalMethodIds[et.flow_id ?? 0] ?? null,
          material_id: mapMaterialIds[et.master_material_id ?? 0] ?? null,
          activity_id: mapActivityIds[et.activity_id ?? 0] ?? null,
          entity_id: mapEntityIds[et.entity_id ?? 0] ?? null,
          stock_disposal_id:
            mapDisposalStockIds[et.stock_extermination_id ?? 0] ?? null,
          opening_qty: et.opening_qty ?? 0,
          change_qty: et.change_qty ?? 0,
          created_by: mapUserIds[et.created_by ?? 0] ?? null,
          updated_by: mapUserIds[et.updated_by ?? 0] ?? null,
          created_at: et.createdAt ?? new Date(),
          updated_at: et.updatedAt ?? new Date(),
          report_number:
            numberOfDocumentFromOrders.find((o) => o.id === et.order_id)
              ?.no_document ?? null,
          comment:
            orderComments.find((oc) => oc.order_id === et.order_id)?.comment ??
            null,
        }
      })
    )
    .executeTakeFirst()

  const insertedIds = Array.from(
    { length: exterminationTransactions.length },
    (_, i) => Number(res.insertId) + i
  )

  const mapGlobalIds = {}
  for (const [i, et] of exterminationTransactions.entries()) {
    mapGlobalIds[et.id] = insertedIds[i]
  }

  for (const et of exterminationTransactions) {
    const programId = await getPlatformProgramIdByPlatformActivityId(
      mapActivityIds[et.activity_id ?? 0] as number
    )

    if (programId) {
      await insertTableMapping("extermination_transactions", programId, {
        [et.id]: mapGlobalIds[et.id],
      })
    }
  }

  console.log(
    `Successfully migrated ${exterminationTransactions.length} disposal transactions`
  )
  return mapGlobalIds
}
