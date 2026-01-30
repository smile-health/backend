import { collect } from "@smile-health/lib/utils.js"
import { sql } from "kysely"
import { getMigrationDB } from "../../../db.migration.js"
import { db } from "../../../db.platform.js"
import { getMapMaterialIds, resetIncrement, safeSqlJoin } from "../../../helper.js"
import {
  MAP_EXISTING_ACTIVITY_IDS,
  MAP_EXISTING_TO_PLATFORM,
} from "../../const.js"
import { IMMUNIZATION } from "../../constants/program.js"
import { migrateMaterialActivities } from "./material-activities.js"
import { migrateMaterialCompanions } from "./material-companions.js"
import { migrateMaterialConditions } from "./material-conditions.js"
import { migrateMaterialManufactures } from "./material-manufactures.js"

const formatDuration = (startTime: Date, endTime: Date): string => {
  const durationMs = endTime.getTime() - startTime.getTime()
  const hours = Math.floor(durationMs / (1000 * 60 * 60))
  const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60))
  const seconds = Math.floor((durationMs % (1000 * 60)) / 1000)
  return `${hours}h ${minutes}m ${seconds}s`
}

export const migrateMaterialRelations = async (
  batchSize: number,
  programId = 1,
  truncate = false,
) => {
  const startTime = new Date()
  console.log(
    `Migration material relations started at: ${startTime.toLocaleString()}`
  )
  console.info("migration start...")

  if (truncate && programId === IMMUNIZATION) {
    console.log("Deleting immunization material relations...")
    await deleteMaterialRelations(programId)
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
        .selectFrom("master_materials as m")
        .select(["m.id"])
        .orderBy("m.id")
        .where("deleted_at", "is", null)
        .limit(batchSize)
        .offset(page * batchSize)
        .execute()

      if (rows.length === 0) {
        break
      }
      const materialIds = collect(rows, "id")
      const mapGlobalIds = await getMapMaterialIds(progId, materialIds)

      await db.transaction().execute(async (trx) => {
        await Promise.all([
          migrateMaterialActivities(
            trx,
            migrationDB,
            progId,
            materialIds,
            mapGlobalIds
          ),
          migrateMaterialCompanions(trx, migrationDB, progId, materialIds),
          migrateMaterialConditions(
            trx,
            migrationDB,
            materialIds,
            mapGlobalIds
          ),
          migrateMaterialManufactures(
            trx,
            migrationDB,
            progId,
            materialIds,
            mapGlobalIds
          ),
        ])
      })
      page++
      console.log(`program ${progId}, batch ${page} is finished`)
    }
  }

  const endTime = new Date()
  console.log(
    `Migration material relations completed at: ${endTime.toLocaleString()}`
  )
  console.log(`Total duration: ${formatDuration(startTime, endTime)}`)
  console.log("migration finished")
  process.exit(0)
}

export const deleteMaterialRelations = async (programId = IMMUNIZATION) => {
  const platformProgramIds = MAP_EXISTING_TO_PLATFORM[programId] ?? []
  const idsSql = safeSqlJoin(platformProgramIds)

  await sql`
    DELETE ma, mc, mp, mm
    FROM material_workspaces m
    LEFT JOIN ws_material_activities ma ON ma.material_id = m.id
    LEFT JOIN ws_material_companions mc ON mc.material_id = m.id
    LEFT JOIN ws_material_permissions mp ON mc.material_id = m.id
    LEFT JOIN ws_material_manufactures mm ON mm.material_id = m.id
    WHERE m.workspace_id IN (${idsSql})
  `.execute(db)

  // Reset auto increment for deleted tables
  await resetIncrement(db, "ws_material_activities")
  await resetIncrement(db, "ws_material_companions")
  await resetIncrement(db, "ws_material_permissions")
  await resetIncrement(db, "ws_material_manufactures")
}
