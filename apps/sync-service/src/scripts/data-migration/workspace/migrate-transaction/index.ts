import { collect } from "@smile/lib/utils.js"
import { sql } from "kysely"
import { getMigrationDB } from "../../../db.migration.js"
import { db } from "../../../db.platform.js"
import {
  MAP_EXISTING_ACTIVITY_IDS,
  MAP_EXISTING_TO_PLATFORM,
} from "../../const.js"
import { IMMUNIZATION } from "../../constants/program.js"
import { migrateConsumptions } from "./consumptions.js"
import { migratePurchases } from "./purchases.js"
import { migrateTransactions } from "./transactions.js"
import { deleteTableMapping, resetIncrement } from "../../../helper.js"

const formatDuration = (startTime: Date, endTime: Date): string => {
  const durationMs = endTime.getTime() - startTime.getTime()
  const hours = Math.floor(durationMs / (1000 * 60 * 60))
  const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60))
  const seconds = Math.floor((durationMs % (1000 * 60)) / 1000)
  return `${hours}h ${minutes}m ${seconds}s`
}

/**
 * Migrate transactions and related records in batches.
 * Supports incremental migration by filtering source rows using updatedAt.
 */
export const migrateTransactionAndRelations = async (
  batchSize: number,
  programId = 1,
  truncate = false,
  updatedAfter?: string,
  updatedBefore?: string,
  skipConsumptions = false
) => {
  const startTime = new Date()
  console.log(
    `Migration transaction and relations started at: ${startTime.toLocaleString()}`
  )
  console.info("migration start...")

  // Log the update time filters if provided
  if (updatedAfter) {
    console.log(`Update after: ${updatedAfter}`)
  }
  if (updatedBefore) {
    console.log(`Update before: ${updatedBefore}`)
  }

  if (truncate && programId === IMMUNIZATION) {
    console.log("Deleting immunization transaction relations...")
    await deleteTransactionRelations(programId, updatedAfter, updatedBefore)
  }

  const migrationDB = getMigrationDB(programId)
  const platformProgramIds = MAP_EXISTING_TO_PLATFORM[programId] ?? []

  for (const progId of platformProgramIds) {
    const activityIds = MAP_EXISTING_ACTIVITY_IDS[progId]
    if (activityIds?.length === 0) {
      continue
    }

    let page = 0
    while (true) {
      let query = migrationDB
        .selectFrom("transactions as t")
        .select(["t.id"])
        .where("t.deleted_at", "is", null)
        .where("t.activity_id", "in", activityIds ?? [-1])

      // Apply updatedAt-based filtering when provided
      if (updatedAfter) {
        query = query.where("t.updatedAt", ">=", updatedAfter)
      }
      if (updatedBefore) {
        query = query.where("t.updatedAt", "<", updatedBefore)
      }

      // Order by updatedAt when filtering by time to keep batches stable
      if (updatedAfter || updatedBefore) {
        query = query.orderBy(["t.updatedAt", "t.id"]) as typeof query
      } else {
        query = query.orderBy(["t.createdAt", "t.id"]) as typeof query
      }

      const rows = await query
        .limit(batchSize)
        .offset(page * batchSize)
        .execute()

      if (rows.length === 0) {
        break
      }
      const trxIds = collect(rows, "id")

      const batchStartTime = new Date()
      
      await db.transaction().execute(async (trx) => {
        const mapGlobalIds = await migrateTransactions(
          trx,
          migrationDB,
          progId,
          trxIds
        )
        if (!skipConsumptions) {
          await migrateConsumptions(
            trx,
            migrationDB,
            progId,
            trxIds,
            mapGlobalIds
          )
        }
        await migratePurchases(trx, migrationDB, progId, trxIds, mapGlobalIds)
      })
      
      const batchEndTime = new Date()
      const batchDuration = formatDuration(batchStartTime, batchEndTime)
      page++
      console.log(`program ${progId}, batch ${page} is finished - Batch size: ${trxIds.length} - Duration: ${batchDuration}`)
    }
  }

  const endTime = new Date()
  console.log(
    `Migration transaction and relations completed at: ${endTime.toLocaleString()}`
  )
  console.log(`Total duration: ${formatDuration(startTime, endTime)}`)
  console.log("migration finished")
  process.exit(0)
}

export const deleteTransactionRelations = async (
  programId = IMMUNIZATION,
  updatedAfter?: string,
  updatedBefore?: string
) => {
  const platformProgramIds = MAP_EXISTING_TO_PLATFORM[programId] ?? []
  const idsSql = sql.join(
    platformProgramIds.map((id) => sql`${id}`),
    sql`, `
  )

  // Apply time-based filtering if provided
  if (updatedAfter || updatedBefore) {
    // Get transaction IDs that match the time criteria from migration DB
    const migrationDB = getMigrationDB(programId)
    const platformProgramIds = MAP_EXISTING_TO_PLATFORM[programId] ?? []

    // Collect all activity IDs for these programs
    const allActivityIds: number[] = []
    for (const progId of platformProgramIds) {
      const activityIds = MAP_EXISTING_ACTIVITY_IDS[progId]
      if (activityIds && activityIds.length > 0) {
        allActivityIds.push(...activityIds)
      }
    }

    if (allActivityIds.length === 0) {
      console.log(
        "No activities found for the specified programs, skipping deletion."
      )
      return
    }

    // Build the query using a more compatible approach
    let timeFilterQuery = migrationDB
      .selectFrom("transactions")
      .select(["id"])
      .where("deleted_at", "is", null)
      .where("activity_id", "in", allActivityIds)

    if (updatedAfter) {
      timeFilterQuery = timeFilterQuery.where(
        "updatedAt",
        ">=",
        updatedAfter as unknown as Date
      )
    }
    if (updatedBefore) {
      timeFilterQuery = timeFilterQuery.where(
        "updatedAt",
        "<",
        updatedBefore as unknown as Date
      )
    }

    const filteredTrxIds = await timeFilterQuery.execute()

    if (filteredTrxIds.length > 0) {
      const trxIdsSql = sql.join(
        filteredTrxIds.map((row) => sql`${row.id}`),
        sql`, `
      )

      await sql`
        DELETE t, p, c
        FROM ws_activities a
        LEFT JOIN ws_transactions t ON t.activity_id = a.id
        LEFT JOIN ws_purchases p ON p.source_id = t.id and p.source_type = 'transaction'
        LEFT JOIN ws_consumptions c ON c.transaction_id = t.id
        WHERE a.program_id IN (${idsSql})
        AND t.id IN (${trxIdsSql})
      `.execute(db)
    } else {
      // No transactions match the time criteria, skip deletion
      console.log(
        "No transactions found within the specified time range, skipping deletion."
      )
      return
    }
  } else {
    // No time filtering - delete all transactions for the programs
    await sql`
      DELETE t, p, c
      FROM ws_activities a
      LEFT JOIN ws_transactions t ON t.activity_id = a.id
      LEFT JOIN ws_purchases p ON p.source_id = t.id and p.source_type = 'transaction'
      LEFT JOIN ws_consumptions c ON c.transaction_id = t.id
      WHERE a.program_id IN (${idsSql})
    `.execute(db)
  }

  // Reset auto increment for deleted tables
  await resetIncrement(db, "ws_transactions")
  await resetIncrement(db, "ws_purchases")
  await resetIncrement(db, "ws_consumptions")
  await deleteTableMapping("transactions", platformProgramIds)
}
