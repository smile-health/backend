/* eslint-disable @typescript-eslint/no-explicit-any */
import { collect } from "@smile/lib/utils.js"
import { sql } from "kysely"
import { db as mappingDB } from "../../../../common/infrastructure/database/index.js"
import { getMigrationDB } from "../../../db.migration.js"
import { db } from "../../../db.platform.js"
import {
  deleteTableMapping,
  getMapEntityIds,
  resetIncrement,
  safeSqlJoin,
} from "../../../helper.js"
import { MAP_EXISTING_TO_PLATFORM } from "../../const.js"
import { IMMUNIZATION } from "../../constants/program.js"
import { migrateCustomerVendors } from "./customer-vendors.js"
import { migrateEntityActivities } from "./entity-activities.js"
import { migrateEntityMaterialActivities } from "./entity-material-activities.js"

const formatDuration = (startTime: Date, endTime: Date): string => {
  const durationMs = endTime.getTime() - startTime.getTime()
  const hours = Math.floor(durationMs / (1000 * 60 * 60))
  const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60))
  const seconds = Math.floor((durationMs % (1000 * 60)) / 1000)
  return `${hours}h ${minutes}m ${seconds}s`
}

export const migrateEntityRelations = async (
  batchSize: number,
  programId = 1,
  currentBatch?: number,
  currentProgramId = 0,
  truncate = false
) => {
  const startTime = new Date()
  console.info(
    `Migration entity relations started at: ${startTime.toLocaleString()}`
  )
  console.info("migration start...")

  if (truncate && programId === IMMUNIZATION) {
    console.log("Deleting immunization entity relations...")
    await deleteEntityRelations(programId)
  }

  const migrationDB = getMigrationDB(programId)

  await resetIncrement(db, "ws_entity_activities")
  await resetIncrement(db, "ws_entity_material_activities")
  await resetIncrement(db, "ws_customer_vendors")
  await resetIncrement(mappingDB, "mapping_entity_material_activities")

  const platformProgramIds = MAP_EXISTING_TO_PLATFORM[programId] ?? []

  const processProgramId = async (progId: number) => {
    const programStartTime = new Date()
    console.log(
      `🚀 Program ${progId} migration started at: ${programStartTime.toLocaleString()}`
    )

    let page = currentProgramId === progId ? (currentBatch ?? 0) : 0
    if (currentProgramId > progId) {
      return
    }

    console.log(`Starting migration for program ID: ${progId}`)

    let totalBatches = 0
    let totalEntities = 0
    while (true) {
      const batchStartTime = new Date()
      const rows = await migrationDB
        .selectFrom("entities as e")
        .select(["e.id"])
        .where("e.deleted_at", "is", null)
        .orderBy("e.id")
        .limit(batchSize)
        .offset(page * batchSize)
        .execute()

      if (rows.length === 0) {
        break
      }
      totalBatches++
      totalEntities += rows.length

      const entityIds = collect(rows, "id")
      const mapGlobalIds = await getMapEntityIds(progId, entityIds)

      // Option 1: Keep transactions sequential within each program
      await db.transaction().execute(async (trx) => {
        console.log(
          `  📊 Program ${progId} - migrating entity activities (batch ${page + 1})`
        )
        await migrateEntityActivities(
          trx,
          migrationDB,
          progId,
          entityIds,
          mapGlobalIds
        )

        console.log(
          `  🧪 Program ${progId} - migrating entity material activities (batch ${page + 1})`
        )
        await migrateEntityMaterialActivities(
          trx,
          migrationDB,
          progId,
          entityIds,
          mapGlobalIds
        )

        console.log(
          `  🤝 Program ${progId} - migrating customer vendors (batch ${page + 1})`
        )
        await migrateCustomerVendors(trx, migrationDB, progId, entityIds)
      })

      const batchEndTime = new Date()
      const batchDuration = formatDuration(batchStartTime, batchEndTime)
      page++
      console.log(
        `  ✅ Program ${progId}, batch ${page} completed in ${batchDuration} (${rows.length} entities)`
      )
    }

    const programEndTime = new Date()
    const programDuration = formatDuration(programStartTime, programEndTime)
    console.log(`🎉 Program ${progId} migration completed!`)
    console.log(`   📅 Started: ${programStartTime.toLocaleString()}`)
    console.log(`   🏁 Finished: ${programEndTime.toLocaleString()}`)
    console.log(`   ⏱️ Duration: ${programDuration}`)
    console.log(`   📊 Total batches: ${totalBatches}`)
    console.log(`   🔢 Total entities: ${totalEntities}`)
    console.log(
      `   📈 Average entities/batch: ${totalBatches > 0 ? Math.round(totalEntities / totalBatches) : 0}`
    )
    console.log(
      `   ⚡ Average time/batch: ${totalBatches > 0 ? formatDuration(programStartTime, new Date(programStartTime.getTime() + (programEndTime.getTime() - programStartTime.getTime()) / totalBatches)) : "0s"}`
    )
  }

  // Enhanced main execution with overall timing
  const overallStartTime = new Date()
  console.log(
    `🌟 Starting migration for all programs at: ${overallStartTime.toLocaleString()}`
  )
  console.log(`📋 Programs to process: [${platformProgramIds.join(", ")}]`)

  // Execute all program IDs sequentially to avoid database deadlocks
  const programResults = []
  for (const progId of platformProgramIds) {
    try {
      await processProgramId(progId)
      programResults.push({ progId, status: "success" })

      // Memory cleanup and connection management after each program
      console.log(`🧹 Cleaning up resources for program ${progId}...`)

      // Force garbage collection if available
      if (global.gc) {
        global.gc()
        console.log(`♻️ Garbage collection completed for program ${progId}`)
      }

      // Close any lingering database connections
      try {
        const migrationDB = getMigrationDB(progId)
        await migrationDB.destroy()
        console.log(`🔌 Migration DB connections closed for program ${progId}`)
      } catch (dbError) {
        console.warn(
          `⚠️ Warning: Could not close migration DB for program ${progId}:`,
          dbError
        )
      }

      // Add a small delay to allow system resources to be freed
      await new Promise((resolve) => setTimeout(resolve, 2000))
      console.log(`⏱️ Resource cleanup delay completed for program ${progId}`)
    } catch (error) {
      programResults.push({ progId, status: "failed", error })
      console.error(`❌ Program ${progId} failed:`, error)

      // Still attempt cleanup even on failure
      try {
        if (global.gc) global.gc()
        const migrationDB = getMigrationDB(progId)
        await migrationDB.destroy()
      } catch (cleanupError) {
        console.warn(`⚠️ Cleanup failed for program ${progId}:`, cleanupError)
      }
    }
  }

  const overallEndTime = new Date()
  const overallDuration = formatDuration(overallStartTime, overallEndTime)

  // Calculate success/failure counts from results
  const successfulPrograms = programResults.filter(
    (result) => result.status === "success"
  ).length
  const failedPrograms = programResults.filter(
    (result) => result.status === "failed"
  ).length

  // Summary report
  console.log(`\n🏆 MIGRATION SUMMARY REPORT`)
  console.log(`=====================================`)
  console.log(`📅 Overall started: ${overallStartTime.toLocaleString()}`)
  console.log(`🏁 Overall finished: ${overallEndTime.toLocaleString()}`)
  console.log(`⏱️ Total duration: ${overallDuration}`)
  console.log(`📊 Programs processed: ${platformProgramIds.length}`)
  console.log(`✅ Successful: ${successfulPrograms}`)
  console.log(`❌ Failed: ${failedPrograms}`)

  console.log(
    `\n🎯 Migration completed with ${successfulPrograms}/${platformProgramIds.length} programs successful`
  )

  // Final cleanup before exit
  console.log(`\n🧹 Performing final cleanup...`)
  try {
    // Close main database connections
    await db.destroy()
    await mappingDB.destroy()
    console.log(`🔌 All database connections closed`)

    // Final garbage collection
    if (global.gc) {
      global.gc()
      console.log(`♻️ Final garbage collection completed`)
    }

    console.log(`✨ Cleanup completed successfully`)
  } catch (cleanupError) {
    console.warn(`⚠️ Warning during final cleanup:`, cleanupError)
  }

  process.exit(0)
}

export const deleteEntityRelations = async (programId = IMMUNIZATION) => {
  const platformProgramIds = MAP_EXISTING_TO_PLATFORM[programId] ?? []
  const idsSql = safeSqlJoin(platformProgramIds)

  await sql`
    DELETE ea, ema, cv, cva
    FROM entity_workspaces e
    LEFT JOIN ws_entity_activities ea ON ea.entity_id = e.id
    LEFT JOIN ws_entity_material_activities ema ON ema.entity_id = e.id
    LEFT JOIN ws_customer_vendors cv ON cv.vendor_id = e.id
    LEFT JOIN ws_customer_vendor_activities cva ON cva.customer_vendor_id = cv.id
    WHERE e.workspace_id IN (${idsSql})
  `.execute(db)

  // Reset auto increment for deleted tables
  await resetIncrement(db, "ws_entity_activities")
  await resetIncrement(db, "ws_entity_material_activities")
  await resetIncrement(db, "ws_customer_vendors")

  await deleteTableMapping("entity_material_activities", platformProgramIds)
}
