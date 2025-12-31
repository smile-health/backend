import { db } from "../../../db.platform.js"
import { sql } from "kysely"
import { migrateAsikAggregate } from "./asik-aggregate.js"
import { migrateAyoSehat } from "./ayo-sehat.js"

const formatDuration = (startTime: Date, endTime: Date): string => {
  const durationMs = endTime.getTime() - startTime.getTime()
  const hours = Math.floor(durationMs / (1000 * 60 * 60))
  const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60))
  const seconds = Math.floor((durationMs % (1000 * 60)) / 1000)
  return `${hours}h ${minutes}m ${seconds}s`
}

export const migrateIntegrationData = async (
  batchSize: number,
  programId = 1,
  truncate = false
) => {
  const startTime = new Date()
  console.log(
    `Migration Integration data started at: ${startTime.toLocaleString()}`
  )
  console.info("migration start...")

  // Truncate tables if requested
  if (truncate) {
    console.log("Truncating Integration tables...")
    
    await db.transaction().execute(async (trx) => {
      await sql`SET FOREIGN_KEY_CHECKS = 0`.execute(trx)
      await sql`TRUNCATE TABLE integration_asik_aggregate`.execute(trx)
      await sql`TRUNCATE TABLE integration_ayo_sehat`.execute(trx)
      await sql`SET FOREIGN_KEY_CHECKS = 1`.execute(trx)
    })
    
    console.log("✅ Tables truncated successfully")
  }

  try {
    // Migrate ASIK Aggregate
    console.log("\n📦 Starting ASIK Aggregate migration...")
    const asikAggregateResult = await migrateAsikAggregate(batchSize, programId)
    
    // Migrate Ayo Sehat
    console.log("\n📦 Starting Ayo Sehat migration...")
    const ayoSehatResult = await migrateAyoSehat(batchSize, programId)

    const endTime = new Date()
    const duration = formatDuration(startTime, endTime)

    console.log("\n🎉 Integration migration completed successfully!")
    console.log(`📊 Summary:`)
    console.log(`   - ASIK Aggregate: ${asikAggregateResult.count} records`)
    console.log(`   - Ayo Sehat: ${ayoSehatResult.count} records`)
    console.log(`⏱️  Total duration: ${duration}`)
    console.log(`🏁 Migration finished at: ${endTime.toLocaleString()}`)

    process.exit(0)
  } catch (error) {
    console.error("❌ Integration migration failed")
    console.error(error)
    process.exit(1)
  }
}