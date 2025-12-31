import { db as syncDB } from "@/common/infrastructure/database/index.js"
import { deleteTableMapping, getMapUserIds } from "@/scripts/helper.js"
import { collect } from "@smile/lib/utils.js"
import { getMigrationDB } from "../../db.migration.js"
import { db } from "../../db.platform.js"
import { MAP_EXISTING_TO_PLATFORM } from "../const.js"
import { IMMUNIZATION } from "../constants/program.js"

// Imun: 1, 6, 8
const MAP_ACTIVITY_TO_PROGRAM_ID = {
  pkd: 2,
  malaria: 3,
  mbs: 3,
  tb: 4,
  tbso: 4,
  tbro: 4,
  tbtpt: 4,
  tbnoat: 4,
  hiv: 5,
  rabies: 6,
  "anti-venom": 7,
  dengue: 8,
  "bmhp-skrining": 9,
  rutin: 1,
  bias: 1,
  ori: 1,
  campaign: 1,
  covid: 1,
  bian: 1,
  extended: 1,
  difteri: 20,
}
const formatDuration = (startTime: Date, endTime: Date): string => {
  const durationMs = endTime.getTime() - startTime.getTime()
  const hours = Math.floor(durationMs / (1000 * 60 * 60))
  const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60))
  const seconds = Math.floor((durationMs % (1000 * 60)) / 1000)
  return `${hours}h ${minutes}m ${seconds}s`
}

export const migrateActivity = async (
  truncate: boolean,
  limit: number,
  programId = 1
) => {
  const startTime = new Date()
  console.info(`Migration activity started at: ${startTime.toLocaleString()}`)
  console.info("migration activity start...")

  if (truncate && programId === IMMUNIZATION) {
    console.log("Deleting previous Immunization activities")

    const programIds = MAP_EXISTING_TO_PLATFORM[programId] ?? []

    // Only execute delete queries if programIds is not empty
    if (programIds.length > 0) {
      await db
        .deleteFrom("ws_activities")
        .where("program_id", "in", programIds)
        .execute()
      await deleteTableMapping("activities", programIds)
    } else {
      console.log("No program IDs found in mapping, skipping deletion")
    }
  }

  const migrationDB = getMigrationDB(programId)
  const rows = await migrationDB
    .selectFrom("master_activities")
    .select(["id", "created_by", "updated_by"])
    .where("deleted_at", "is", null)
    .orderBy("id")
    .$if(limit > 0, (qb) => qb.limit(limit))
    .execute()

  console.info(`migrating ${rows.length} activities`)

  for (const row of rows) {
    console.info(`migrating activities ${row.id}`)

    const activity = await migrationDB
      .selectFrom("master_activities")
      .selectAll()
      .where("master_activities.id", "=", row.id)
      .executeTakeFirst()
    if (!activity) {
      continue
    }

    const activityProgramId = MAP_ACTIVITY_TO_PROGRAM_ID[activity.code ?? ""]
    if (!activityProgramId) {
      continue
    }
    const [mappedUserProgramCreatedBy, mappedUserProgramUpdatedBy] =
      await Promise.all([
        getMapUserIds(activityProgramId, collect(rows, "created_by")),
        getMapUserIds(activityProgramId, collect(rows, "updated_by")),
      ])

    const wsActivity = await db
      .insertInto("ws_activities")
      .values({
        name: activity.name ?? "",
        program_id: activityProgramId,
        code: activity.code,
        is_ordered_purchase: activity.is_ordered_purchase,
        is_ordered_sales: activity.is_ordered_sales,
        created_at: activity?.created_at,
        updated_at: activity?.updated_at,
        created_by:
          mappedUserProgramCreatedBy[activity.created_by ?? -1] ?? null,
        updated_by:
          mappedUserProgramUpdatedBy[activity.updated_by ?? -1] ?? null,
      })
      .executeTakeFirst()

    await syncDB
      .insertInto("mapping_activities")
      .values({
        existing_activity_id: activity.id,
        platform_activity_id: Number(wsActivity.insertId),
        program_id: activityProgramId,
        existing_program_id: programId,
      })
      .execute()
  }

  const endTime = new Date()
  const duration = formatDuration(startTime, endTime)

  console.info(
    `\n🎉 Migration activity finished at: ${endTime.toLocaleString()}`
  )
  console.info(`📊 Total duration: ${duration}`)
  console.info(`📈 Summary:`)
  console.info(`   - Activities: ${rows.length} records`)
  console.info("✅ All global activities migration completed successfully")
  process.exit(0)
}
