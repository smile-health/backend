import { db } from "@/scripts/db.platform.js"
import { DB } from "@/scripts/types.platform.js"
import { Kysely } from "kysely"
import { getMigrationDB } from "../../db.migration.js"

const LOCATION = {
  PROVINCE: 0,
  REGENCY: 1,
  SUBDISTRICT: 2,
  VILLAGE: 3,
}

const formatDuration = (startTime: Date, endTime: Date): string => {
  const durationMs = endTime.getTime() - startTime.getTime()
  const hours = Math.floor(durationMs / (1000 * 60 * 60))
  const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60))
  const seconds = Math.floor((durationMs % (1000 * 60)) / 1000)
  return `${hours}h ${minutes}m ${seconds}s`
}

export const migrateLocation = async (programId = 1) => {
  const startTime = new Date()
  console.log(`Migration location started at: ${startTime.toLocaleString()}`)
  console.log("migrating province ...")

  const migrationDB = getMigrationDB(programId)
  const provinces = await migrationDB
    .selectFrom("provinces")
    .where("id", "!=", "00")
    .selectAll()
    .where("deleted_at", "is", null)
    .execute()

  await db
    .insertInto("locations")
    .values(
      provinces.map((row) => ({
        id: Number(row.id),
        name: row.name ?? "",
        lat: row.lat,
        lng: row.lng,
        level: LOCATION.PROVINCE,
      }))
    )
    .execute()

  console.log("migrating regency ...")

  const regencies = await migrationDB
    .selectFrom("regencies")
    .selectAll()
    .where("deleted_at", "is", null)
    .execute()
  await db
    .insertInto("locations")
    .values(
      regencies.map((row) => ({
        id: Number(row.id),
        name: row.name ?? "",
        lat: row.lat,
        lng: row.lng,
        parent_id: Number(row.province_id),
        level: LOCATION.REGENCY,
      }))
    )
    .execute()

  console.log("migrating subdistrict ...")

  const subdistricts = await migrationDB
    .selectFrom("sub_districts")
    .selectAll()
    .where("deleted_at", "is", null)
    .execute()
  await insertInBatches(
    db,
    "locations",
    subdistricts.map((row) => ({
      id: Number(row.id),
      name: row.name ?? "",
      parent_id: Number(row.regency_id),
      level: LOCATION.SUBDISTRICT,
    }))
  )

  console.log("migrating village ...")

  const villages = await migrationDB
    .selectFrom("villages")
    .selectAll()
    .where("deleted_at", "is", null)
    .execute()
  await insertInBatches(
    db,
    "locations",
    villages.map((row) => ({
      id: Number(row.id),
      name: row.name ?? "",
      parent_id: Number(row.sub_district_id),
      level: LOCATION.VILLAGE,
    }))
  )

  const endTime = new Date()
  const duration = formatDuration(startTime, endTime)

  console.log(
    `\n🎉 Migration location finished at: ${endTime.toLocaleString()}`
  )
  console.info(`📊 Total duration: ${duration}`)
  console.info(`📈 Summary:`)
  console.info(`   - Provinces: ${provinces.length} records`)
  console.info(`   - Regencies: ${regencies.length} records`)
  console.info(`   - Sub District: ${subdistricts.length} records`)
  console.info(`   - Villages: ${villages.length} records`)
  console.info("✅ All global location migration completed successfully")
  process.exit(0)
}

async function insertInBatches<T>(
  db: Kysely<DB>, // Pass the Kysely instance
  tableName: string, // Name of the table
  rows: T[], // Rows to insert
  batchSize: number = 10000 // Default batch size
): Promise<void> {
  // Split the rows into chunks
  for (let i = 0; i < rows.length; i += batchSize) {
    const chunk = rows.slice(i, i + batchSize)
    await db
      .insertInto(tableName as keyof DB)
      .values(chunk)
      .execute()
  }
}
