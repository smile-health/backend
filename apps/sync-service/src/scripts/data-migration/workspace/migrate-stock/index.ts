import { collect } from "@smile-health/lib/utils.js"
import { sql } from "kysely"
import { getMigrationDB } from "../../../db.migration.js"
import { db } from "../../../db.platform.js"
import {
  MAP_EXISTING_ACTIVITY_IDS,
  MAP_EXISTING_TO_PLATFORM,
} from "../../const.js"
import { IMMUNIZATION } from "../../constants/program.js"
import { migrateStockExterminations } from "./stock-exterminations.js"
import { migrateStocks } from "./stocks.js"
import { deleteTableMapping, resetIncrement, safeSqlJoin } from "../../../helper.js"

const formatDuration = (startTime: Date, endTime: Date): string => {
  const durationMs = endTime.getTime() - startTime.getTime()
  const hours = Math.floor(durationMs / (1000 * 60 * 60))
  const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60))
  const seconds = Math.floor((durationMs % (1000 * 60)) / 1000)
  return `${hours}h ${minutes}m ${seconds}s`
}

export const migrateStockAndRelations = async (
  batchSize: number,
  programId = 1,
  truncate = false
) => {
  const startTime = new Date()
  console.log(
    `Migration stock and relations started at: ${startTime.toLocaleString()}`
  )
  console.info("migration start...")

  if (truncate && programId === IMMUNIZATION) {
    console.log("Deleting immunization stock relations...")
    await deleteStockRelations(programId)
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
      const rows = await migrationDB
        .selectFrom("stocks as s")
        .select(["s.id"])
        .orderBy("s.id")
        .where("s.activity_id", "in", activityIds ?? [-1])
        .orderBy("s.id")
        .limit(batchSize)
        .offset(page * batchSize)
        .execute()

      if (rows.length === 0) {
        break
      }
      const stockIds = collect(rows, "id")

      await db.transaction().execute(async (trx) => {
        const mapGlobalIds = await migrateStocks(
          trx,
          migrationDB,
          progId,
          stockIds
        )
        await migrateStockExterminations(
          trx,
          migrationDB,
          progId,
          stockIds,
          mapGlobalIds
        )
      })

      page++
      console.log(`program ${progId}, batch ${page} is finished`)
    }
  }

  const endTime = new Date()
  console.log(
    `Migration stock and relations completed at: ${endTime.toLocaleString()}`
  )
  console.log(`Total duration: ${formatDuration(startTime, endTime)}`)
  console.log("migration finished")
  process.exit(0)
}

export const deleteStockRelations = async (programId = IMMUNIZATION) => {
  const platformProgramIds = MAP_EXISTING_TO_PLATFORM[programId] ?? []
  const idsSql = safeSqlJoin(platformProgramIds)

  await sql`
    DELETE s
    FROM ws_activities a
    LEFT JOIN ws_stocks s ON s.activity_id = a.id
    WHERE a.program_id IN (${idsSql})
  `.execute(db)

  await resetIncrement(db, "ws_stocks")
  await deleteTableMapping("stocks", platformProgramIds)
}
