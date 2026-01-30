import { collect } from "@smile-health/lib/utils.js"
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

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const retryWithBackoff = async <T>(
  operation: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 1000
): Promise<T> => {
  let lastError: Error | null = null

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error as Error

      // Check if it's a connection error that should be retried
      const errorMessage = error?.toString().toLowerCase() || ""
      const shouldRetry =
        errorMessage.includes("packets out of order") ||
        errorMessage.includes("connection") ||
        errorMessage.includes("timeout") ||
        errorMessage.includes("econnreset")

      if (!shouldRetry || attempt === maxRetries) {
        throw error
      }

      const delay = baseDelay * Math.pow(2, attempt)
      console.warn(
        `⚠️ Database connection issue detected, retrying in ${delay}ms... (attempt ${attempt + 1}/${maxRetries + 1})`
      )
      await sleep(delay)
    }
  }

  throw lastError
}

export const migrateCustomerVendorsOnly = async (
  batchSize: number,
  programId = 1,
  currentBatch?: number,
  currentProgramId = 0,
  useSequentialProcessing = false,
  truncate = false
) => {
  const startTime = new Date()
  console.info(
    `Migration customer vendors only started at: ${startTime.toLocaleString()}`
  )
  console.info(
    `Processing mode: ${useSequentialProcessing ? "Sequential" : "Parallel"}`
  )

  if (truncate && programId === IMMUNIZATION) {
    console.log("Deleting immunization customer vendor relations...")
    await deleteCustomerVendorRelations(programId)
  }

  const migrationDB = getMigrationDB(programId)
  const platformProgramIds = MAP_EXISTING_TO_PLATFORM[programId] ?? []

  const processProgramId = async (progId: number) => {
    const programStartTime = new Date()
    console.log(
      `🚀 Program ${progId} customer vendors migration started at: ${programStartTime.toLocaleString()}`
    )

    let page = currentProgramId === progId ? (currentBatch ?? 0) : 0
    if (currentProgramId > progId) {
      return
    }

    // Use the provided batch size parameter
    const safeBatchSize = batchSize

    while (true) {
      try {
        const rows = await retryWithBackoff(async () => {
          return await migrationDB
            .selectFrom("entities as e")
            .select(["e.id"])
            .where("e.deleted_at", "is", null)
            .orderBy("e.id")
            .limit(safeBatchSize)
            .offset(page * safeBatchSize)
            .execute()
        })

        if (rows.length === 0) {
          break
        }

        const entityIds = collect(rows, "id")

        await retryWithBackoff(async () => {
          return await db.transaction().execute(async (trx) => {
            await migrateCustomerVendors(trx, migrationDB, progId, entityIds)
          })
        })

        page++
        console.log(
          `  ✅ Program ${progId}, batch ${page} completed (${rows.length} entities)`
        )

        // Add small delay between batches to reduce connection pressure
        await sleep(100)
      } catch (error) {
        console.error(
          `❌ Fatal error in program ${progId}, batch ${page}:`,
          error
        )
        throw error
      }
    }

    const programEndTime = new Date()
    const programDuration = formatDuration(programStartTime, programEndTime)
    console.log(`🎉 Program ${progId} customer vendors migration completed!`)
    console.log(`   ⏱️ Duration: ${programDuration}`)
  }

  const overallStartTime = new Date()
  let programResults

  if (useSequentialProcessing) {
    // Option 1: Sequential Processing
    console.log(`\n📊 SEQUENTIAL MIGRATION PROGRESS`)
    console.log(`Total programs to process: ${platformProgramIds.length}`)
    console.log(`Programs: [${platformProgramIds.join(", ")}]`)

    programResults = []
    for (const progId of platformProgramIds) {
      try {
        console.log(`🚀 Starting program ${progId}...`)
        await processProgramId(progId)
        programResults.push({ progId, status: "success" })
        console.log(`✅ Program ${progId} completed successfully`)

        // Memory cleanup between programs
        if (global.gc) {
          global.gc()
        }

        // Brief pause between programs to reduce system pressure
        if (progId !== platformProgramIds[platformProgramIds.length - 1]) {
          console.log("Waiting 10 seconds before next program...")
          await new Promise((resolve) => setTimeout(resolve, 10000))
        }
      } catch (error) {
        console.error(`❌ Program ${progId} failed:`, error)
        programResults.push({ progId, status: "failed", error })
      }
    }
  } else {
    // Original: Parallel Processing
    console.log(`\n📊 PARALLEL MIGRATION PROGRESS`)
    console.log(`Total programs to process: ${platformProgramIds.length}`)
    console.log(`Programs: [${platformProgramIds.join(", ")}]`)
    console.log(
      `⚠️ Warning: Running in parallel mode - monitor system resources\n`
    )

    programResults = await Promise.allSettled(
      platformProgramIds.map(async (progId) => {
        try {
          await processProgramId(progId)
          return { progId, status: "success" }
        } catch (error) {
          return { progId, status: "failed", error }
        }
      })
    )

    // Convert Promise.allSettled results to consistent format
    programResults = programResults.map((result) =>
      result.status === "fulfilled" ? result.value : result.reason
    )
  }

  const overallEndTime = new Date()
  const overallDuration = formatDuration(overallStartTime, overallEndTime)

  console.log(`\n🏆 CUSTOMER VENDORS MIGRATION SUMMARY`)
  console.log(`=====================================`)
  console.log(`⏱️ Total duration: ${overallDuration}`)
  console.log(
    `🔄 Processing mode: ${useSequentialProcessing ? "Sequential" : "Parallel"}`
  )

  // Enhanced summary with individual program results
  const successfulPrograms = programResults.filter(
    (r) => r.status === "success"
  )
  const failedPrograms = programResults.filter((r) => r.status === "failed")

  console.log(
    `✅ Successful programs: ${successfulPrograms.length}/${platformProgramIds.length}`
  )
  if (successfulPrograms.length > 0) {
    console.log(
      `   Programs: [${successfulPrograms.map((r) => r.progId).join(", ")}]`
    )
  }

  if (failedPrograms.length > 0) {
    console.log(
      `❌ Failed programs: ${failedPrograms.length}/${platformProgramIds.length}`
    )
    console.log(
      `   Programs: [${failedPrograms.map((r) => r.progId).join(", ")}]`
    )
    failedPrograms.forEach((result) => {
      console.error(
        `   Program ${result.progId} error:`,
        result.error?.message || result.error
      )
    })
  }

  console.log(
    `✅ Migration completed ${failedPrograms.length === 0 ? "successfully" : "with errors"}`
  )
  process.exit(failedPrograms.length === 0 ? 0 : 1)
}

export const deleteCustomerVendorRelations = async (
  programId = IMMUNIZATION
) => {
  const platformProgramIds = MAP_EXISTING_TO_PLATFORM[programId] ?? []
  const idsSql = safeSqlJoin(platformProgramIds)

  await sql`
    DELETE cv, cva
    FROM entity_workspaces e
    LEFT JOIN ws_customer_vendors cv ON cv.vendor_id = e.id
    LEFT JOIN ws_customer_vendor_activities cva ON cva.customer_vendor_id = cv.id
    WHERE e.workspace_id IN (${idsSql})
  `.execute(db)

  // Reset auto increment for deleted tables
  await resetIncrement(db, "ws_customer_vendors")
}

export const deleteEntityActivityRelations = async (
  programId = IMMUNIZATION
) => {
  const platformProgramIds = MAP_EXISTING_TO_PLATFORM[programId] ?? []
  const idsSql = safeSqlJoin(platformProgramIds)

  await sql`
    DELETE ea
    FROM entity_workspaces e
    LEFT JOIN ws_entity_activities ea ON ea.entity_id = e.id
    WHERE e.workspace_id IN (${idsSql})
  `.execute(db)

  // Reset auto increment for deleted tables
  await resetIncrement(db, "ws_entity_activities")
}

export const deleteEntityMaterialActivityRelations = async (
  programId = IMMUNIZATION
) => {
  const platformProgramIds = MAP_EXISTING_TO_PLATFORM[programId] ?? []
  const idsSql = safeSqlJoin(platformProgramIds)

  await sql`
    DELETE ema
    FROM entity_workspaces e
    LEFT JOIN ws_entity_material_activities ema ON ema.entity_id = e.id
    WHERE e.workspace_id IN (${idsSql})
  `.execute(db)

  // Reset auto increment for deleted tables
  await resetIncrement(db, "ws_entity_material_activities")
  await resetIncrement(mappingDB, "mapping_entity_material_activities")

  await deleteTableMapping("entity_material_activities", platformProgramIds)
}

export const migrateEntityActivitiesOnly = async (
  batchSize: number,
  programId = 1,
  currentBatch?: number,
  currentProgramId = 0,
  useSequentialProcessing = false,
  truncate = false
) => {
  const startTime = new Date()
  console.info(
    `Migration entity activities only started at: ${startTime.toLocaleString()}`
  )
  console.info(
    `Processing mode: ${useSequentialProcessing ? "Sequential" : "Parallel"}`
  )

  if (truncate && programId === IMMUNIZATION) {
    console.log("Deleting immunization entity activity relations...")
    await deleteEntityActivityRelations(programId)
  }

  const migrationDB = getMigrationDB(programId)

  await resetIncrement(db, "ws_entity_activities")

  const platformProgramIds = MAP_EXISTING_TO_PLATFORM[programId] ?? []

  const processProgramId = async (progId: number) => {
    const programStartTime = new Date()
    console.log(
      `🚀 Program ${progId} entity activities migration started at: ${programStartTime.toLocaleString()}`
    )

    let page = currentProgramId === progId ? (currentBatch ?? 0) : 0
    if (currentProgramId > progId) {
      return
    }

    // Use the provided batch size parameter
    const safeBatchSize = batchSize

    while (true) {
      try {
        const rows = await retryWithBackoff(async () => {
          return await migrationDB
            .selectFrom("entities as e")
            .select(["e.id"])
            .where("e.deleted_at", "is", null)
            .orderBy("e.id")
            .limit(safeBatchSize)
            .offset(page * safeBatchSize)
            .execute()
        })

        if (rows.length === 0) {
          break
        }

        const entityIds = collect(rows, "id")
        const mapGlobalIds = await retryWithBackoff(async () => {
          return await getMapEntityIds(progId, entityIds)
        })

        await retryWithBackoff(async () => {
          return await db.transaction().execute(async (trx) => {
            await migrateEntityActivities(
              trx,
              migrationDB,
              progId,
              entityIds,
              mapGlobalIds
            )
          })
        })

        page++
        console.log(
          `  ✅ Program ${progId}, batch ${page} completed (${rows.length} entities)`
        )

        // Add small delay between batches to reduce connection pressure
        await sleep(100)
      } catch (error) {
        console.error(
          `❌ Fatal error in program ${progId}, batch ${page}:`,
          error
        )
        throw error
      }
    }

    const programEndTime = new Date()
    const programDuration = formatDuration(programStartTime, programEndTime)
    console.log(`🎉 Program ${progId} entity activities migration completed!`)
    console.log(`   ⏱️ Duration: ${programDuration}`)
  }

  const overallStartTime = new Date()
  let programResults

  if (useSequentialProcessing) {
    // Option 1: Sequential Processing
    console.log(`\n📊 SEQUENTIAL MIGRATION PROGRESS`)
    console.log(`Total programs to process: ${platformProgramIds.length}`)
    console.log(`Programs: [${platformProgramIds.join(", ")}]`)

    programResults = []
    for (const progId of platformProgramIds) {
      try {
        console.log(`🚀 Starting program ${progId}...`)
        await processProgramId(progId)
        programResults.push({ progId, status: "success" })
        console.log(`✅ Program ${progId} completed successfully`)

        // Memory cleanup between programs
        if (global.gc) {
          global.gc()
        }

        // Brief pause between programs to reduce system pressure
        if (progId !== platformProgramIds[platformProgramIds.length - 1]) {
          console.log("Waiting 10 seconds before next program...")
          await new Promise((resolve) => setTimeout(resolve, 10000))
        }
      } catch (error) {
        console.error(`❌ Program ${progId} failed:`, error)
        programResults.push({ progId, status: "failed", error })
      }
    }
  } else {
    // Original: Parallel Processing
    console.log(`\n📊 PARALLEL MIGRATION PROGRESS`)
    console.log(`Total programs to process: ${platformProgramIds.length}`)
    console.log(`Programs: [${platformProgramIds.join(", ")}]`)
    console.log(
      `⚠️ Warning: Running in parallel mode - monitor system resources\n`
    )

    programResults = await Promise.allSettled(
      platformProgramIds.map(async (progId) => {
        try {
          await processProgramId(progId)
          return { progId, status: "success" }
        } catch (error) {
          return { progId, status: "failed", error }
        }
      })
    )

    // Convert Promise.allSettled results to consistent format
    programResults = programResults.map((result) =>
      result.status === "fulfilled" ? result.value : result.reason
    )
  }

  const overallEndTime = new Date()
  const overallDuration = formatDuration(overallStartTime, overallEndTime)

  console.log(`\n🏆 ENTITY ACTIVITIES MIGRATION SUMMARY`)
  console.log(`=====================================`)
  console.log(`⏱️ Total duration: ${overallDuration}`)
  console.log(
    `🔄 Processing mode: ${useSequentialProcessing ? "Sequential" : "Parallel"}`
  )

  // Enhanced summary with individual program results
  const successfulPrograms = programResults.filter(
    (r) => r.status === "success"
  )
  const failedPrograms = programResults.filter((r) => r.status === "failed")

  console.log(
    `✅ Successful programs: ${successfulPrograms.length}/${platformProgramIds.length}`
  )
  if (successfulPrograms.length > 0) {
    console.log(
      `   Programs: [${successfulPrograms.map((r) => r.progId).join(", ")}]`
    )
  }

  if (failedPrograms.length > 0) {
    console.log(
      `❌ Failed programs: ${failedPrograms.length}/${platformProgramIds.length}`
    )
    console.log(
      `   Programs: [${failedPrograms.map((r) => r.progId).join(", ")}]`
    )
    failedPrograms.forEach((result) => {
      console.error(
        `   Program ${result.progId} error:`,
        result.error?.message || result.error
      )
    })
  }

  console.log(
    `✅ Migration completed ${failedPrograms.length === 0 ? "successfully" : "with errors"}`
  )
  process.exit(failedPrograms.length === 0 ? 0 : 1)
}

export const migrateEntityMaterialActivitiesOnly = async (
  batchSize: number,
  programId = 1,
  currentBatch?: number,
  currentProgramId = 0,
  useSequentialProcessing = false, // New parameter
  truncate = false
) => {
  const startTime = new Date()
  console.info(
    `Migration entity material activities only started at: ${startTime.toLocaleString()}`
  )
  console.info(
    `Processing mode: ${useSequentialProcessing ? "Sequential" : "Parallel"}`
  )

  if (truncate && programId === IMMUNIZATION) {
    console.log("Deleting immunization entity material activity relations...")
    await deleteEntityMaterialActivityRelations(programId)
  }

  const migrationDB = getMigrationDB(programId)

  await resetIncrement(db, "ws_entity_material_activities")
  await resetIncrement(mappingDB, "mapping_entity_material_activities")

  const platformProgramIds = MAP_EXISTING_TO_PLATFORM[programId] ?? []

  const processProgramId = async (progId: number) => {
    const programStartTime = new Date()
    console.log(
      `🚀 Program ${progId} entity material activities migration started at: ${programStartTime.toLocaleString()}`
    )

    let page = currentProgramId === progId ? (currentBatch ?? 0) : 0
    if (currentProgramId > progId) {
      return
    }

    // Use the provided batch size parameter
    const safeBatchSize = batchSize

    while (true) {
      try {
        const rows = await retryWithBackoff(async () => {
          return await migrationDB
            .selectFrom("entities as e")
            .select(["e.id"])
            .where("e.deleted_at", "is", null)
            .orderBy("e.id")
            .limit(safeBatchSize)
            .offset(page * safeBatchSize)
            .execute()
        })

        if (rows.length === 0) {
          break
        }

        const entityIds = collect(rows, "id")
        const mapGlobalIds = await retryWithBackoff(async () => {
          return await getMapEntityIds(progId, entityIds)
        })

        await retryWithBackoff(async () => {
          return await db.transaction().execute(async (trx) => {
            await migrateEntityMaterialActivities(
              trx,
              migrationDB,
              progId,
              entityIds,
              mapGlobalIds
            )
          })
        })

        page++
        console.log(
          `  ✅ Program ${progId}, batch ${page} completed (${rows.length} entities)`
        )

        // Add small delay between batches to reduce connection pressure
        await sleep(100)
      } catch (error) {
        console.error(
          `❌ Fatal error in program ${progId}, batch ${page}:`,
          error
        )
        throw error
      }
    }

    const programEndTime = new Date()
    const programDuration = formatDuration(programStartTime, programEndTime)
    console.log(
      `🎉 Program ${progId} entity material activities migration completed!`
    )
    console.log(`   ⏱️ Duration: ${programDuration}`)
  }

  const overallStartTime = new Date()
  let programResults

  if (useSequentialProcessing) {
    // Option 1: Sequential Processing
    console.log(`\n📊 SEQUENTIAL MIGRATION PROGRESS`)
    console.log(`Total programs to process: ${platformProgramIds.length}`)
    console.log(`Programs: [${platformProgramIds.join(", ")}]`)

    programResults = []
    for (const progId of platformProgramIds) {
      try {
        console.log(`🚀 Starting program ${progId}...`)
        await processProgramId(progId)
        programResults.push({ progId, status: "success" })
        console.log(`✅ Program ${progId} completed successfully`)

        // Memory cleanup between programs
        if (global.gc) {
          global.gc()
        }

        // Brief pause between programs to reduce system pressure
        if (progId !== platformProgramIds[platformProgramIds.length - 1]) {
          console.log("Waiting 10 seconds before next program...")
          await new Promise((resolve) => setTimeout(resolve, 10000))
        }
      } catch (error) {
        console.error(`❌ Program ${progId} failed:`, error)
        programResults.push({ progId, status: "failed", error })

        // Optional: Stop on first failure (uncomment if needed)
        // throw error
      }
    }
  } else {
    // Original: Parallel Processing
    console.log(`\n📊 PARALLEL MIGRATION PROGRESS`)
    console.log(`Total programs to process: ${platformProgramIds.length}`)
    console.log(`Programs: [${platformProgramIds.join(", ")}]`)
    console.log(
      `⚠️ Warning: Running in parallel mode - monitor system resources\n`
    )

    programResults = await Promise.allSettled(
      platformProgramIds.map(async (progId) => {
        try {
          await processProgramId(progId)
          return { progId, status: "success" }
        } catch (error) {
          return { progId, status: "failed", error }
        }
      })
    )

    // Convert Promise.allSettled results to consistent format
    programResults = programResults.map((result) =>
      result.status === "fulfilled" ? result.value : result.reason
    )
  }

  const overallEndTime = new Date()
  const overallDuration = formatDuration(overallStartTime, overallEndTime)

  console.log(`\n🏆 ENTITY MATERIAL ACTIVITIES MIGRATION SUMMARY`)
  console.log(`=====================================`)
  console.log(`⏱️ Total duration: ${overallDuration}`)
  console.log(
    `🔄 Processing mode: ${useSequentialProcessing ? "Sequential" : "Parallel"}`
  )

  // Enhanced summary with individual program results
  const successfulPrograms = programResults.filter(
    (r) => r.status === "success"
  )
  const failedPrograms = programResults.filter((r) => r.status === "failed")

  console.log(
    `✅ Successful programs: ${successfulPrograms.length}/${platformProgramIds.length}`
  )
  if (successfulPrograms.length > 0) {
    console.log(
      `   Programs: [${successfulPrograms.map((r) => r.progId).join(", ")}]`
    )
  }

  if (failedPrograms.length > 0) {
    console.log(
      `❌ Failed programs: ${failedPrograms.length}/${platformProgramIds.length}`
    )
    console.log(
      `   Programs: [${failedPrograms.map((r) => r.progId).join(", ")}]`
    )
    failedPrograms.forEach((result) => {
      console.error(
        `   Program ${result.progId} error:`,
        result.error?.message || result.error
      )
    })
  }

  console.log(
    `✅ Migration completed ${failedPrograms.length === 0 ? "successfully" : "with errors"}`
  )
  process.exit(failedPrograms.length === 0 ? 0 : 1)
}
