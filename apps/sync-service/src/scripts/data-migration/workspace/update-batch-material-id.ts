import { db } from "../../db.platform.js"

const formatDuration = (startTime: Date, endTime: Date): string => {
  const durationMs = endTime.getTime() - startTime.getTime()
  const hours = Math.floor(durationMs / (1000 * 60 * 60))
  const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60))
  const seconds = Math.floor((durationMs % (1000 * 60)) / 1000)
  return `${hours}h ${minutes}m ${seconds}s`
}

export async function updateBatchMaterialId(batchSize: number) {
  const startTime = Date.now()
  console.info(
    `Batch material ID update migration started at: ${new Date(startTime).toISOString()}`
  )

  try {
    const totalResult = await db
      .selectFrom("ws_batches")
      .select(db.fn.count("id").as("total"))
      .executeTakeFirst()

    const totalBatches = Number(totalResult?.total || 0)

    console.info(`Found ${totalBatches} batches to update`)

    // Single UPDATE with JOIN - most performant approach for 20k records
    console.log("Executing single bulk update with JOIN...")

    const result = await db.executeQuery({
      sql: `
        UPDATE ws_batches b 
        INNER JOIN (
          SELECT DISTINCT s.batch_id, s.material_id
          FROM ws_stocks s
          WHERE s.deleted_at IS NULL 
            AND s.material_id IS NOT NULL
            AND s.batch_id IN (
              SELECT id FROM ws_batches
            )
        ) s ON s.batch_id = b.id
        SET b.material_id = s.material_id
      `,
      parameters: [],
    })

    const processedCount = result.numAffectedRows || 0
    console.log(`Updated ${processedCount} records in single operation`)
    process.exit(0)
  } catch (error) {
    const endTime = Date.now()
    const duration = endTime - startTime
    const durationMinutes = Math.round((duration / 60000) * 100) / 100

    console.error("❌ Error updating batch material_id")
    console.error(error)
    console.error(
      `Process failed after ${durationMinutes} minutes (${duration}ms)`
    )
    console.error(`End time: ${new Date(endTime).toISOString()}`)

    // Exit with error code
    process.exit(1)
  }
}
