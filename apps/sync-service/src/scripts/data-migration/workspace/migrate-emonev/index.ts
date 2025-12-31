import { db } from "../../../db.platform.js"
import { sql } from "kysely"
import { migrateEmonevMaterials } from "./emonev-materials.js"
import { migrateEmonevProvinces } from "./emonev-provinces.js"
import { migrateEmonevRegencies } from "./emonev-regencies.js"
import { migrateEmonevRegenciesUpdated } from "./emonev-regencies-updated.js"

const formatDuration = (startTime: Date, endTime: Date): string => {
  const durationMs = endTime.getTime() - startTime.getTime()
  const hours = Math.floor(durationMs / (1000 * 60 * 60))
  const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60))
  const seconds = Math.floor((durationMs % (1000 * 60)) / 1000)
  return `${hours}h ${minutes}m ${seconds}s`
}

export const migrateEmonevIntegration = async (
  batchSize: number,
  programId = 1,
  truncate = false
) => {
  const startTime = new Date()
  console.log(
    `Migration Emonev integration started at: ${startTime.toLocaleString()}`
  )
  console.info("migration start...")

  // Truncate tables if requested
  if (truncate) {
    console.log("Truncating Emonev integration tables...")
    
    await db.transaction().execute(async (trx) => {
      await sql`SET FOREIGN_KEY_CHECKS = 0`.execute(trx)
      await sql`TRUNCATE TABLE integration_emonev_regencies_updated`.execute(trx)
      await sql`TRUNCATE TABLE integration_emonev_regencies`.execute(trx)
      await sql`TRUNCATE TABLE integration_emonev_provinces`.execute(trx)
      await sql`TRUNCATE TABLE integration_emonev_materials`.execute(trx)
      await sql`SET FOREIGN_KEY_CHECKS = 1`.execute(trx)
    })
    
    console.log("✅ Tables truncated successfully")
  }

  try {
    // Migrate Emonev Materials
    console.log("\n📦 Starting Emonev Materials migration...")
    const emonevMaterialsResult = await migrateEmonevMaterials(batchSize, programId)
    
    // Migrate Emonev Provinces
    console.log("\n📦 Starting Emonev Provinces migration...")
    const emonevProvincesResult = await migrateEmonevProvinces(batchSize, programId)
    
    // Migrate Emonev Regencies
    console.log("\n📦 Starting Emonev Regencies migration...")
    const emonevRegenciesResult = await migrateEmonevRegencies(batchSize, programId)
    
    // Migrate Emonev Regencies Updated
    console.log("\n📦 Starting Emonev Regencies Updated migration...")
    const emonevRegenciesUpdatedResult = await migrateEmonevRegenciesUpdated(batchSize, programId)

    const endTime = new Date()
    const duration = formatDuration(startTime, endTime)

    console.info(
      `\n🎉 Migration Emonev integration finished at: ${endTime.toLocaleString()}`
    )
    console.info(`📊 Total duration: ${duration}`)
    console.info(`📈 Summary:`)
    console.info(`   - Emonev Materials: ${emonevMaterialsResult.count} records`)
    console.info(`   - Emonev Provinces: ${emonevProvincesResult.count} records`)
    console.info(`   - Emonev Regencies: ${emonevRegenciesResult.count} records`)
    console.info(`   - Emonev Regencies Updated: ${emonevRegenciesUpdatedResult.count} records`)
    console.info("✅ All Emonev integration migration completed successfully")
    
    process.exit(0)
  } catch (error) {
    console.error("❌ Migration failed")
    console.error(error)
    process.exit(1)
  }
}