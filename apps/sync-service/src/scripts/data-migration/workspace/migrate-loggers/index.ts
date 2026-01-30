import { logger } from "@smile-health/lib/logger.js"
import { getMigrationDB } from "../../../db.migration_iot.js"
import { db } from "../../../db.platform.js"
import { migrateLoggers } from "./loggers.js"

export async function migrateLoggersIntegration(
  batchSize = 1000,
  programId?: number,
  truncate = false
) {
  const startTime = Date.now()

  try {
    logger.info("Starting loggers migration", {
      batchSize,
      programId,
      truncate,
    })

    // Truncate tables if needed
    if (truncate) {
      logger.info("Truncating ws_loggers table...")
      await db.deleteFrom("ws_loggers").execute()
      logger.info("ws_loggers table truncated")
    }

    // Migrate loggers
    const migratedCount = await migrateLoggers(
      batchSize,
      programId || 1
    )

    const duration = Date.now() - startTime
    logger.info("Loggers migration completed", {
      migratedCount,
      duration: `${duration}ms`,
      durationMinutes: `${(duration / 1000 / 60).toFixed(2)} minutes`,
    })

    return { migratedCount, duration }
  } catch (error) {
    logger.error("Loggers migration failed", error)
    throw error
  }
}