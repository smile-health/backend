import { db } from "../../../db.platform.js"
import { getMigrationDB } from "../../../db.migration.js"
import { collect } from "@smile-health/lib/utils.js"
import { Kysely, Transaction, sql } from "kysely"
import {
  getMapEntityIds,
  getMapMaterialIds,
  getMapUserIds,
  insertTableMapping,
  getMapActivityIds,
  getMapBatchIds,
  getMapStockIds,
  getMapTransactionReasonIds,
  resetIncrement,
  deleteTableMapping,
} from "../../../helper.js"
import { DB } from "../../../types.platform.js"
import { MigrationDB } from "../../../types.js"

import {
  MAP_EXISTING_ACTIVITY_IDS,
  MAP_EXISTING_TO_PLATFORM,
} from "../../const.js"
import { IMMUNIZATION } from "../../constants/program.js"

const formatDuration = (startTime: Date, endTime: Date): string => {
  const durationMs = endTime.getTime() - startTime.getTime()
  const hours = Math.floor(durationMs / (1000 * 60 * 60))
  const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60))
  const seconds = Math.floor((durationMs % (1000 * 60)) / 1000)
  return `${hours}h ${minutes}m ${seconds}s`
}

export const migrateDisposalShipment = async (
  batchSize: number,
  existingProgramId = 1,
  truncate = false
) => {
  const startTime = new Date()
  console.log(
    `Migration disposal shipment started at: ${startTime.toLocaleString()}`
  )

  const platformProgramIds = MAP_EXISTING_TO_PLATFORM[existingProgramId] ?? []

  if (truncate && existingProgramId === IMMUNIZATION) {
    console.log("Truncating immunization disposal shipment tables...")
    await deleteDisposalShipmentRelations(existingProgramId)
  }

  const migrationDB = getMigrationDB(existingProgramId)

  for (const platformProgramId of platformProgramIds) {
    console.log(
      `Migrating disposal shipment for existing program ID ${existingProgramId} to platform program ID ${platformProgramId}`
    )

    const activityIds = MAP_EXISTING_ACTIVITY_IDS[platformProgramId]
    if (activityIds?.length === 0) {
      continue
    }

    let page = 0
    while (true) {
      const rows = await migrationDB
        .selectFrom("orders")
        .select(["id"])
        .where("deleted_at", "is", null)
        .where("type", "=", 5)
        .where("activity_id", "in", activityIds ?? [-1])
        .orderBy("id")
        .limit(batchSize)
        .offset(page * batchSize)
        .execute()

      if (rows.length === 0) {
        break
      }
      const ids = collect(rows, "id")

      await db.transaction().execute(async (trx) => {
        await doMigrate(
          trx,
          migrationDB,
          existingProgramId,
          platformProgramId,
          ids
        )
      })

      page++
      console.log(`Processed batch ${page} with ${rows.length} records`)
    }
  }

  const endTime = new Date()
  console.log(
    `Migration disposal shipment completed at: ${endTime.toLocaleString()}`
  )
  console.log(`Total duration: ${formatDuration(startTime, endTime)}`)
  process.exit(0)
}

async function doMigrate(
  trx: Transaction<DB>,
  migrationDB: Kysely<MigrationDB>,
  existingProgramId: number,
  platformProgramId: number,
  ids: number[]
) {
  //ws_disposal_shipment
  const shipments = await migrationDB
    .selectFrom("orders")
    .select([
      "id",
      "activity_id", //need convert
      "customer_id", //need convert
      "vendor_id", //need convert
      "status", //dikirim=4, diterima=5, dibatalkan=6
      "type",
      "no_document",
      "shipped_at",
      "fulfilled_at",
      "cancelled_at",
      "created_by", //need convert
      "updated_by", //need convert
      "created_at",
      "updated_at",
      "device_type",
    ])
    .where("id", "in", ids)
    .execute()

  if (shipments.length === 0) return

  const [
    mapActivityIds,
    mapCustomerIds,
    mapVendorIds,
    mapCreatedByIds,
    mapUpdatedByIds,
  ] = await Promise.all([
    getMapActivityIds(platformProgramId, collect(shipments, "activity_id")),
    getMapEntityIds(platformProgramId, collect(shipments, "customer_id")),
    getMapEntityIds(platformProgramId, collect(shipments, "vendor_id")),
    getMapUserIds(platformProgramId, collect(shipments, "created_by")),
    getMapUserIds(platformProgramId, collect(shipments, "updated_by")),
  ])

  const shipmentsMap = new Map()
  const result = await trx
    .insertInto("ws_disposal_shipments")
    .values(
      shipments.map((item) => {
        const v = {
          activity_id: mapActivityIds[item.activity_id ?? 0] ?? 0,
          customer_id: mapCustomerIds[item.customer_id ?? 0] ?? 0,
          vendor_id: mapVendorIds[item.vendor_id ?? 0] ?? 0,
          status: item.status,
          type: 5,
          no_document: item.no_document,
          comments: "",
          shipped_at: item.shipped_at,
          fulfilled_at: item.fulfilled_at,
          cancelled_at: item.cancelled_at,
          created_by: mapCreatedByIds[item.created_by ?? 0] ?? 0,
          updated_by: mapUpdatedByIds[item.updated_by ?? 0] ?? 0,
          created_at: item.created_at,
          updated_at: item.updated_at,
          device_type: item.device_type,
        }
        shipmentsMap.set(item.id, v)

        return v
      })
    )
    .executeTakeFirst()

  const shipmentNewIds = Array.from(
    { length: shipments.length },
    (_, i) => Number(result.insertId) + i
  )

  const newShipmentIdsMap = new Map<number, number>()
  const newShipmentIdsObj = {}

  let index = 0

  for (const [oldId] of shipmentsMap) {
    const newId = shipmentNewIds[index]

    if (!newId) throw new Error("old id x new id not found")

    newShipmentIdsMap.set(oldId, newId)
    newShipmentIdsObj[oldId] = newId

    index++
  }

  await insertTableMapping(
    "extermination_shipments",
    platformProgramId,
    newShipmentIdsObj
  )

  //ws_dis
  const oldComments = await migrationDB
    .selectFrom("order_comments")
    .where("order_id", "in", ids)
    .select([
      "order_id",
      "user_id",
      "comment",
      "order_status",
      "created_by",
      "created_at",
    ])
    .execute()

  if (oldComments.length > 0) {
    const [mapCreatedByIds_2] = await Promise.all([
      getMapUserIds(platformProgramId, collect(oldComments, "created_by")),
    ])
    const values = oldComments.map((item) => {
      return {
        disposal_shipment_id: newShipmentIdsMap.get(item.order_id ?? 0) ?? 0,
        comment: item.comment ?? "",
        status: item.order_status,
        user_id: mapCreatedByIds_2[item.created_by ?? 0] ?? 0,
        created_at: item.created_at,
      }
    })
    const commentResult = await trx
      .insertInto("ws_disposal_shipment_comments")
      .values(values)
      .executeTakeFirst()

    // Insert comment mappings
    const commentNewIds = Array.from(
      { length: oldComments.length },
      (_, i) => Number(commentResult.insertId) + i
    )

    const commentMappings = {}
    oldComments.forEach((comment, index) => {
      const newId = commentNewIds[index]
      if (newId) {
        commentMappings[comment.order_id] = newId
      }
    })

    if (Object.keys(commentMappings).length > 0) {
      await insertTableMapping(
        "extermination_shipment_comments",
        platformProgramId,
        commentMappings
      )
    }
  }

  //items
  const oldItems = await migrationDB
    .selectFrom("order_items")
    .select([
      "id",
      "material_id",
      "order_id",
      "qty",
      "confirmed_qty",
      "created_by",
      "updated_by",
      "created_at",
      "updated_at",
    ])
    .where("order_id", "in", ids)
    .execute()

  const itemsIdsMap = new Map<number, number>()
  if (oldItems.length > 0) {
    const [mapMaterialIds, mapCreatedByIds_3] = await Promise.all([
      getMapMaterialIds(platformProgramId, collect(oldItems, "material_id")),
      getMapUserIds(platformProgramId, collect(oldItems, "created_by")),
    ])

    const itemMap = new Map()
    const values = oldItems.map((item) => {
      const disposal_shipment_id = newShipmentIdsMap.get(item.order_id)

      const v = {
        disposal_shipment_id: disposal_shipment_id ?? 0,
        material_id: mapMaterialIds[item.material_id ?? 0] ?? 0,
        qty: item.qty ?? 0,
        confirmed_qty: item.confirmed_qty,
        notes: "",
        created_by: mapCreatedByIds_3[item.created_by ?? 0] ?? 0,
        created_at: item.created_at,
        updated_at: item.updated_at,
      }

      itemMap.set(item.id, v)

      return v
    })

    const result = await trx
      .insertInto("ws_disposal_shipment_items")
      .values(values)
      .executeTakeFirst()

    const itemNewIds = Array.from(
      { length: oldItems.length },
      (_, i) => Number(result.insertId) + i
    )

    const itemMappings = {}
    let index = 0
    for (const [oldId] of itemMap) {
      const newId = itemNewIds[index]
      if (newId) {
        itemsIdsMap.set(oldId, newId)
        itemMappings[oldId] = newId
      }
      index++
    }

    // Insert item mappings
    if (Object.keys(itemMappings).length > 0) {
      await insertTableMapping(
        "extermination_shipment_items",
        platformProgramId,
        itemMappings
      )
    }
  }

  //stocks
  const itemStocks = await migrationDB
    .selectFrom("order_stock_exterminations as osx")
    .innerJoin(
      "stock_exterminations as sx",
      "sx.id",
      "osx.stock_extermination_id"
    )
    .innerJoin("order_stocks as os", "os.id", "osx.order_stock_id")
    .innerJoin("stocks as s", "s.id", "sx.stock_id")
    .select([
      "os.order_item_id", //convert
      "s.batch_id", //convert
      "s.activity_id", //convert

      "sx.stock_id", //convert
      "sx.transaction_reason_id", //convert

      "osx.allocated_discard_qty",
      "osx.allocated_received_qty",
      "osx.created_by",
      "osx.created_at",
      "osx.updated_at",
    ])
    .where("os.order_item_id", "in", collect(oldItems, "id"))
    .execute()

  if (itemStocks.length > 0) {
    const [
      mapCreatedByIds_3,
      mapStockIds,
      mapBatchIds,
      mapActivityIds,
      mapReasonIds,
    ] = await Promise.all([
      getMapUserIds(platformProgramId, collect(itemStocks, "created_by")),
      getMapStockIds(platformProgramId, collect(itemStocks, "stock_id")),
      getMapBatchIds(platformProgramId, collect(itemStocks, "batch_id")),
      getMapActivityIds(platformProgramId, collect(itemStocks, "activity_id")),
      getMapTransactionReasonIds(
        platformProgramId,
        collect(itemStocks, "transaction_reason_id")
      ),
    ])
    const values = itemStocks.map((item) => {
      return {
        disposal_shipment_item_id:
          itemsIdsMap.get(item.order_item_id ?? 0) ?? 0,
        stock_id: mapStockIds[item.stock_id ?? 0] ?? 0,
        batch_id: mapBatchIds[item.batch_id ?? 0] ?? 0,
        activity_id: mapActivityIds[item.activity_id ?? 0] ?? 0,
        transaction_reason_id:
          mapReasonIds[item.transaction_reason_id ?? 0] ?? 0,
        stock_qty: item.allocated_discard_qty + item.allocated_received_qty,
        received_qty: item.allocated_discard_qty,
        discard_qty: item.allocated_received_qty,
        created_by: mapCreatedByIds_3[item.created_by ?? 0] ?? 0,
        created_at: item.created_at,
        updated_at: item.updated_at ?? undefined,
      }
    })
    const stockResult = await trx
      .insertInto("ws_disposal_shipment_stocks")
      .values(values)
      .executeTakeFirst()

    // Insert stock mappings
    const stockNewIds = Array.from(
      { length: itemStocks.length },
      (_, i) => Number(stockResult.insertId) + i
    )

    const stockMappings = {}
    itemStocks.forEach((stock, index) => {
      const newId = stockNewIds[index]
      if (newId && stock.order_item_id !== null && stock.order_item_id !== undefined) {
        stockMappings[stock.order_item_id] = newId
      }
    })

    if (Object.keys(stockMappings).length > 0) {
      await insertTableMapping(
        "extermination_shipment_stocks",
        platformProgramId,
        stockMappings
      )
    }
  }
}

export const deleteDisposalShipmentRelations = async (programId = IMMUNIZATION) => {
  const platformProgramIds = MAP_EXISTING_TO_PLATFORM[programId] ?? []
  const idsSql = sql.join(
    platformProgramIds.map((id) => sql`${id}`),
    sql`, `
  )

  await sql`
    DELETE dss, dsc, dsi, ds
    FROM ws_activities a
    LEFT JOIN ws_disposal_shipments ds ON ds.activity_id = a.id
    LEFT JOIN ws_disposal_shipment_items dsi ON dsi.disposal_shipment_id = ds.id
    LEFT JOIN ws_disposal_shipment_stocks dss ON dss.disposal_shipment_item_id = dsi.id
    LEFT JOIN ws_disposal_shipment_comments dsc ON dsc.disposal_shipment_id = ds.id
    WHERE a.program_id IN (${idsSql})
  `.execute(db)

  // Reset auto increment for deleted tables
  await resetIncrement(db, "ws_disposal_shipments")
  await resetIncrement(db, "ws_disposal_shipment_items")
  await resetIncrement(db, "ws_disposal_shipment_stocks")
  await resetIncrement(db, "ws_disposal_shipment_comments")

  await deleteTableMapping("extermination_shipments", platformProgramIds)
  await deleteTableMapping("extermination_shipment_items", platformProgramIds)
  await deleteTableMapping("extermination_shipment_stocks", platformProgramIds)
  await deleteTableMapping("extermination_shipment_comments", platformProgramIds)
}
