import { collect } from "@smile-health/lib/utils.js"
import { getMigrationDB } from "../../../db.migration.js"
import { db } from "../../../db.platform.js"
import {
  MAP_EXISTING_ACTIVITY_IDS,
  MAP_EXISTING_TO_PLATFORM,
} from "../../const.js"
import { migrateDisposalMethods } from "./disposal-methods-and-reasons.js"
import { migrateDisposalTransactionTypes } from "./disposal-transaction-types.js"
import { migrateDisposalStocks } from "./disposal-stocks.js"
import { migrateDisposalTransactions } from "./disposal-transactions.js"
import { migrateDisposalShipments } from "./disposal-shipment.js"
import { TYPE_ID_DISPOSAL_SHIPMENT } from "./utils/disposal.constants.js"

const formatDuration = (startTime: Date, endTime: Date): string => {
  const durationMs = endTime.getTime() - startTime.getTime()
  const hours = Math.floor(durationMs / (1000 * 60 * 60))
  const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60))
  const seconds = Math.floor((durationMs % (1000 * 60)) / 1000)
  return `${hours}h ${minutes}m ${seconds}s`
}

export const migrateRelationsForDisposal = async (
  batchSize: number,
  programId = 1
) => {
  const startTime = new Date()
  console.log(
    `Migration disposal and relations started at: ${startTime.toLocaleString()}`
  )
  console.info("Disposal migration start...")

  const migrationDB = getMigrationDB(programId)

  await db.transaction().execute(async (trx) => {
    // Migrate disposal methods (from extermination_flow) and their reasons
    await migrateDisposalMethods(trx, migrationDB, programId)

    // Migrate disposal transaction types (from extermination_transaction_types)
    await migrateDisposalTransactionTypes(trx, migrationDB, programId)
  })

  console.log("Disposal relations for disposal finished")
  process.exit(0)
}

export const doMigrateDisposalStocks = async (
  batchSize: number,
  programId = 1
) => {
  const startTime = new Date()
  console.log(
    `Migration disposal and relations started at: ${startTime.toLocaleString()}`
  )
  console.info("Disposal migration start...")

  const migrationDB = getMigrationDB(programId)
  const platformProgramIds = MAP_EXISTING_TO_PLATFORM[programId] ?? []

  for (const progId of platformProgramIds) {
    const activityIds = MAP_EXISTING_ACTIVITY_IDS[progId]
    if (activityIds?.length === 0) {
      continue
    }

    console.log(`Migrating disposal data for program ${progId}`)

    // Migrate disposal stocks and transactions in batches
    let page = 0
    while (true) {
      const rows = await migrationDB
        .selectFrom("stock_exterminations as se")
        .select(["se.id"])
        .orderBy("se.id")
        .limit(batchSize)
        .offset(page * batchSize)
        .execute()

      if (rows.length === 0) {
        break
      }
      const stockExterminationIds = collect(rows, "id")

      await db.transaction().execute(async (trx) => {
        await migrateDisposalStocks(
          trx,
          migrationDB,
          progId,
          stockExterminationIds
        )
      })

      page++
      console.log(`Program ${progId}, disposal stocks batch ${page} finished`)
    }
  }

  const endTime = new Date()
  console.log(
    `Migration disposal and relations completed at: ${endTime.toLocaleString()}`
  )
  console.log(`Total duration: ${formatDuration(startTime, endTime)}`)
  console.log("Disposal migration finished")
  process.exit(0)
}

export const doMigrateDisposalTransactions = async (
  batchSize: number,
  programId = 1
) => {
  const startTime = new Date()
  console.log(
    `Migration disposal transactions started at: ${startTime.toLocaleString()}`
  )
  console.info("Disposal migration start...")

  const migrationDB = getMigrationDB(programId)
  const platformProgramIds = MAP_EXISTING_TO_PLATFORM[programId] ?? []

  const activityIds =
    platformProgramIds
      ?.map((item) => MAP_EXISTING_ACTIVITY_IDS[item])
      .flat()
      .filter((id): id is number => typeof id === "number") ?? []

  if (activityIds.length === 0) return

  console.log(`Migrating disposal data for program ${platformProgramIds}`)

  // Migrate disposal transactions in batches
  let page = 0
  while (true) {
    const exterminationTransactions = await migrationDB
      .selectFrom("extermination_transactions as et")
      .select([
        "et.id",
        "et.extermination_transaction_type_id",
        "et.flow_id",
        "et.master_material_id",
        "et.entity_id",
        "et.stock_extermination_id",
        "et.activity_id",
        "et.order_id",
        "et.opening_qty",
        "et.change_qty",
        "et.created_by",
        "et.updated_by",
        "et.createdAt",
        "et.updatedAt",
        "et.deleted_at",
      ])
      .where("et.activity_id", "in", activityIds)
      .where("et.deleted_at", "is", null)
      .orderBy("et.id")
      .limit(batchSize)
      .offset(page * batchSize)
      .execute()

    if (exterminationTransactions.length === 0) process.exit(0)

    await db.transaction().execute(async (trx) => {
      await migrateDisposalTransactions(
        trx,
        migrationDB,
        platformProgramIds,
        exterminationTransactions
      )
    })

    page++
  }
}

export const doMigrateDisposalShipments = async (
  batchSize: number,
  programId = 1
) => {
  const startTime = new Date()
  console.log(
    `Migration disposal shpments started at: ${startTime.toLocaleString()}`
  )
  console.info("Disposal migration start...")

  const migrationDB = getMigrationDB(programId)
  const platformProgramIds = MAP_EXISTING_TO_PLATFORM[programId] ?? []

  const activityIds =
    platformProgramIds
      ?.map((item) => MAP_EXISTING_ACTIVITY_IDS[item])
      .flat()
      .filter((id): id is number => typeof id === "number") ?? []

  if (activityIds?.length === 0) return

  console.log(`Migrating disposal data for program ${platformProgramIds}`)

  // Migrate disposal transactions in batches
  let page = 0
  while (true) {
    const exterminationShipment = await migrationDB
      .selectFrom("orders as o")
      .select([
        "o.id",
        "o.activity_id",
        "o.customer_id",
        "o.vendor_id",
        "o.status",
        "o.type",
        "o.no_document",
        "o.shipped_at",
        "o.fulfilled_at",
        "o.cancelled_at",
        "o.created_at",
        "o.updated_at",
        "o.deleted_at",
        "o.created_by",
        "o.updated_by",
        "o.deleted_by",
        "o.device_type",
      ])
      .where("o.activity_id", "in", activityIds)
      .where("o.type", "=", TYPE_ID_DISPOSAL_SHIPMENT)
      .where("o.deleted_at", "is", null)
      .orderBy("o.id")
      .limit(batchSize)
      .offset(page * batchSize)
      .execute()

    if (exterminationShipment.length === 0) process.exit(0)

    await db.transaction().execute(async (trx) => {
      await migrateDisposalShipments(
        trx,
        migrationDB,
        platformProgramIds,
        exterminationShipment
      )
    })

    page++
  }
}
