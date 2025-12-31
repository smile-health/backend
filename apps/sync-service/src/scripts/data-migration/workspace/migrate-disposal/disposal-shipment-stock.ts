import { collect } from "@smile/lib/utils.js"
import { Transaction, sql, Kysely } from "kysely"
import { insertTableMapping } from "../../../helper.js"
import {
  getMapActivityIds,
  getMapUserIds,
  getPlatformProgramIdByPlatformActivityId,
  getMapStockIds,
  getMapTransactionReasonIds,
  getMapExterminationShipmentItemIds,
} from "./utils/disposal.helpers.js"
import { MigrationDB } from "../../../types.js"
import { DB } from "../../../types.platform.js"

const getBatchId = async (trx: Transaction<DB>, stockId: number) => {
  const batch = await trx
    .selectFrom("ws_stocks")
    .select(["batch_id"])
    .where("id", "=", stockId)
    .executeTakeFirst()

  return batch?.batch_id ?? null
}

export const migrateDisposalShipmentStocks = async (
  trx: Transaction<DB>,
  migrationDB: Kysely<MigrationDB>,
  programIds: number[],
  exterminationShipmentItems
) => {
  if (exterminationShipmentItems.length === 0) {
    console.log("No disposal shipment stocks to migrate")
    return
  }

  const exterminationShipmentStocks = await migrationDB
    .selectFrom("order_stocks as ost")
    .leftJoin("order_items as oit", "oit.id", "ost.order_item_id")
    .select([
      sql`oit.id`.as("order_item_id"),
      sql`ost.id`.as("order_stock_id"),
      sql`ost.allocated_qty`.as("allocated_qty"),
      sql`ost.stock_id`.as("stock_id"),
      sql`ost.status`.as("status"),
      sql`ost.received_qty`.as("received_qty"),
      sql`ost.ordered_qty`.as("ordered_qty"),
      sql`ost.fulfill_reason`.as("fulfill_reason"),
      sql`ost.other_reason`.as("other_reason"),
      sql`ost.qrcode`.as("qrcode"),
      sql`ost.fulfill_status`.as("fulfill_status"),
      sql`ost.created_by`.as("created_by"),
      sql`ost.updated_by`.as("updated_by"),
      sql`ost.created_at`.as("created_at"),
      sql`ost.updated_at`.as("updated_at"),
    ])
    .where("ost.deleted_at", "is", null)
    .where(
      "order_item_id",
      "in",
      collect(exterminationShipmentItems, "order_item_id")
    )
    .orderBy("ost.id")
    .execute()

  console.log(
    `Migrating ${exterminationShipmentStocks.length} disposal shipment stocks`
  )

  // Get all necessary mappings
  const [
    mapDisposalShipmentItemIds,
    mapActivityIds,
    mapStockIds,
    mapTransactionReasonIds,
    mapUserIds,
  ] = await Promise.all([
    getMapExterminationShipmentItemIds(
      programIds,
      collect(exterminationShipmentItems, "order_item_id")?.filter(
        (stock, index) =>
          collect(exterminationShipmentItems, "order_item_id").indexOf(
            stock
          ) === index
      )
    ),
    getMapActivityIds(
      programIds,
      collect(exterminationShipmentItems, "activity_id")?.filter(
        (stock, index) =>
          collect(exterminationShipmentItems, "activity_id").indexOf(stock) ===
          index
      )
    ),
    getMapStockIds(
      programIds,
      collect(exterminationShipmentStocks, "stock_id")?.filter(
        (stock, index) =>
          collect(exterminationShipmentStocks, "stock_id").indexOf(stock) ===
          index
      ) as number[]
    ),
    getMapTransactionReasonIds(
      programIds,
      collect(exterminationShipmentStocks, "fulfill_reason")?.filter(
        (stock, index) =>
          collect(exterminationShipmentStocks, "fulfill_reason").indexOf(
            stock
          ) === index
      ) as number[]
    ),
    getMapUserIds(
      programIds,
      collect(exterminationShipmentStocks, "created_by", "updated_by")?.filter(
        (stock, index) =>
          collect(
            exterminationShipmentStocks,
            "created_by",
            "updated_by"
          ).indexOf(stock) === index
      ) as number[]
    ),
  ])

  const platformDisposalShipmentStocksValues = await Promise.all(
    exterminationShipmentStocks.map(async (itm) => {
      const activityIdFromExterminationShipmentItems =
        exterminationShipmentItems?.find(
          (esit) => Number(esit.order_item_id) === Number(itm.order_item_id)
        )?.activity_id
      const batchIdFromWsStocksTable = await getBatchId(
        trx,
        mapStockIds[String(itm?.stock_id)]
      )

      return {
        disposal_shipment_item_id:
          mapDisposalShipmentItemIds[String(itm?.order_item_id)],
        stock_id: mapStockIds[String(itm?.stock_id)],
        batch_id: batchIdFromWsStocksTable,
        activity_id:
          mapActivityIds[String(activityIdFromExterminationShipmentItems)],
        stock_qty: itm?.allocated_qty,
        received_qty: itm?.received_qty,
        discard_qty: itm?.allocated_qty,
        transaction_reason_id:
          mapTransactionReasonIds[String(itm?.fulfill_reason)],
        created_by: mapUserIds[String(itm?.created_by)],
        created_at: itm?.created_at ?? new Date().getTime(),
        updated_at: itm?.updated_at ?? new Date().getTime(),
      }
    })
  )

  const res = await trx
    .insertInto("ws_disposal_shipment_stocks")
    .values(platformDisposalShipmentStocksValues)
    .executeTakeFirst()

  const insertedIds = Array.from(
    { length: exterminationShipmentStocks.length },
    (_, i) => Number(res.insertId) + i
  )

  const mapGlobalIds = {}
  for (const [i, et] of exterminationShipmentStocks.entries()) {
    mapGlobalIds[et.order_stock_id] = insertedIds[i]
  }

  for (const cmt of exterminationShipmentStocks) {
    const activityIdFromExterminationShipmentItems =
      exterminationShipmentItems?.find(
        (esit) => Number(esit.order_item_id) === Number(cmt.order_item_id)
      )?.activity_id
    const programId = await getPlatformProgramIdByPlatformActivityId(
      mapActivityIds[String(activityIdFromExterminationShipmentItems)] as number
    )
    if (programId) {
      await insertTableMapping("extermination_shipment_stocks", programId, {
        [cmt.order_stock_id]: mapGlobalIds[cmt.order_stock_id],
      })
    }
  }

  console.log(
    `Successfully migrated ${exterminationShipmentStocks.length} disposal shipment stocks`
  )
}
