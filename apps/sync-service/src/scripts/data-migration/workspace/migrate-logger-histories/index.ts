import { logger } from "@smile-health/lib/logger.js"
import { getMigrationDB } from "../../../db.migration.js"
import { db } from "../../../db.platform.js"
import { migrateLoggerHistories } from "./logger-histories.js"

export async function migrateLoggerHistoriesIntegration(
  batchSize = 1000,
  programId?: number,
  truncate = false
) {
  const startTime = Date.now()

  try {
    logger.info("Starting logger histories migration", {
      batchSize,
      programId,
      truncate,
    })

    // Truncate tables if needed
    if (truncate) {
      logger.info("Truncating ws_logger_histories table...")
      await db.deleteFrom("ws_logger_histories").execute()
      logger.info("ws_logger_histories table truncated")
    }

    // Migrate logger histories
    const migratedCount = await migrateLoggerHistories(
      batchSize,
      programId || 1
    )

    const duration = Date.now() - startTime
    logger.info("Logger histories migration completed", {
      migratedCount,
      duration: `${duration}ms`,
      durationMinutes: `${(duration / 1000 / 60).toFixed(2)} minutes`,
    })

    return { migratedCount, duration }
  } catch (error) {
    logger.error("Logger histories migration failed", error)
    throw error
  }
}