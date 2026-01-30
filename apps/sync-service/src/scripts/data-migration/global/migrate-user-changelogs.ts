import { db } from "@/scripts/db.platform.js"
import { getMapGlobalUserIds, insertTableMapping } from "@/scripts/helper.js"
import { getMigrationDB } from "../../db.migration.js"
import { MAP_EXISTING_TO_PLATFORM } from "../const.js"
import { collect } from "@smile-health/lib/utils.js"

const formatDuration = (startTime: Date, endTime: Date): string => {
  const durationMs = endTime.getTime() - startTime.getTime()
  const hours = Math.floor(durationMs / (1000 * 60 * 60))
  const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60))
  const seconds = Math.floor((durationMs % (1000 * 60)) / 1000)
  return `${hours}h ${minutes}m ${seconds}s`
}

export const migrateUserChangelogs = async (limit: number, programId = 1) => {
  const startTime = new Date()
  console.info(
    `Migration user changelogs started at: ${startTime.toLocaleString()}`
  )

  console.info("migration start...")

  const migrationDB = getMigrationDB(programId)

  let userChangelogCount = 0
  try {
    const rows = await migrationDB
      .selectFrom("user_chg_histories")
      .select(["id", "user_id"])
      .orderBy("id")
      .$if(limit > 0, (qb) => qb.limit(limit))
      .execute()
    userChangelogCount = rows.length

    console.info(`migrating ${rows.length} user changelogs`)

    const existingUserIds = collect(rows, "user_id")
    const mappedPlatformUserGlobal = await getMapGlobalUserIds(existingUserIds)

    for (const row of rows) {
      console.info(`migrating user changelog ${row.id}`)

      const userChgHistory = await migrationDB
        .selectFrom("user_chg_histories")
        .selectAll()
        .where("user_chg_histories.id", "=", row.id)
        .executeTakeFirst()
      if (!userChgHistory) {
        continue
      }

      const insertData = await db
        .insertInto("user_changelogs")
        .values({
          user_id: mappedPlatformUserGlobal[userChgHistory.user_id] ?? 0,
          old_value: userChgHistory.old_values,
          new_value: userChgHistory.new_values,
          field: "",
          created_at: userChgHistory.created_at,
          updated_at: userChgHistory.updated_at,
        })
        .executeTakeFirst()

      console.log("GLOBAL ID", insertData)
      const globalID = Number(insertData.insertId)

      const platformProgramIds = MAP_EXISTING_TO_PLATFORM[programId] ?? []

      for (const progId of platformProgramIds) {
        await insertTableMapping(
          "user_changelogs",
          progId,
          {
            [row.id]: globalID,
          },
          {
            [row.id]: globalID,
          }
        )
      }
    }

    const endTime = new Date()
    const duration = formatDuration(startTime, endTime)

    console.info(
      `\n🎉 Migration user changelogs finished at: ${endTime.toLocaleString()}`
    )
    console.info(`📊 Total duration: ${duration}`)
    console.info(`📈 Summary:`)
    console.info(`   - User Changelogs: ${userChangelogCount} records`)
    console.info(
      "✅ All global user changelogs migration completed successfully"
    )
    process.exit(0)
  } catch (error) {
    console.error("migration failed")
    console.error(error)
    process.exit(1)
  }
}
