import { db } from "../../../db.platform.js"
import { sql } from "kysely"
import { migrateBiofarmaOrders } from "./biofarma-orders.js"
import { migrateBiofarmaSmdvOrders } from "./biofarma-smdv-orders.js"

const formatDuration = (startTime: Date, endTime: Date): string => {
  const durationMs = endTime.getTime() - startTime.getTime()
  const hours = Math.floor(durationMs / (1000 * 60 * 60))
  const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60))
  const seconds = Math.floor((durationMs % (1000 * 60)) / 1000)
  return `${hours}h ${minutes}m ${seconds}s`
}

export const migrateBiofarmaIntegration = async (
  batchSize: number,
  programId = 1,
  truncate = false
) => {
  const startTime = new Date()
  console.log(
    `Migration Biofarma integration started at: ${startTime.toLocaleString()}`
  )
  console.info("migration start...")

  // Truncate tables if requested
  if (truncate) {
    console.log("Truncating Biofarma integration tables...")
    
    await db.transaction().execute(async (trx) => {
      await sql`SET FOREIGN_KEY_CHECKS = 0`.execute(trx)
      await sql`TRUNCATE TABLE integration_biofarma_smdv_orders`.execute(trx)
      await sql`TRUNCATE TABLE integration_biofarma_orders`.execute(trx)
      await sql`SET FOREIGN_KEY_CHECKS = 1`.execute(trx)
    })
    
    console.log("✅ Tables truncated successfully")
  }

  try {
    // Migrate Biofarma Orders
    console.log("\n📦 Starting Biofarma Orders migration...")
    const biofarmaOrdersResult = await migrateBiofarmaOrders(batchSize, programId)
    
    // Migrate Biofarma SMDV Orders
    console.log("\n📦 Starting Biofarma SMDV Orders migration...")
    const biofarmaSmdvOrdersResult = await migrateBiofarmaSmdvOrders(batchSize, programId)

    const endTime = new Date()
    const duration = formatDuration(startTime, endTime)

    console.info(
      `\n🎉 Migration Biofarma integration finished at: ${endTime.toLocaleString()}`
    )
    console.info(`📊 Total duration: ${duration}`)
    console.info(`📈 Summary:`)
    console.info(`   - Biofarma Orders: ${biofarmaOrdersResult.count} records`)
    console.info(`   - Biofarma SMDV Orders: ${biofarmaSmdvOrdersResult.count} records`)
    console.info("✅ All Biofarma integration migration completed successfully")
    
    process.exit(0)
  } catch (error) {
    console.error("❌ Migration failed")
    console.error(error)
    process.exit(1)
  }
}
