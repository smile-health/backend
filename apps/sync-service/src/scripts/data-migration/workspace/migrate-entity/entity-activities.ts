import { collect } from "@smile/lib/utils.js"
import { Kysely, Transaction } from "kysely"
import { getMapActivityIds } from "../../../helper.js"
import { MigrationDB } from "../../../types.js"
import { DB } from "../../../types.platform.js"
import { MAP_EXISTING_ACTIVITY_IDS } from "../../const.js"

const formatDuration = (startTime: Date, endTime: Date): string => {
  const durationMs = endTime.getTime() - startTime.getTime()
  const hours = Math.floor(durationMs / (1000 * 60 * 60))
  const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60))
  const seconds = Math.floor((durationMs % (1000 * 60)) / 1000)
  return `${hours}h ${minutes}m ${seconds}s`
}

export const migrateEntityActivities = async (
  trx: Transaction<DB>,
  migrationDB: Kysely<MigrationDB>,
  programId: number,
  entityIds: number[],
  mapGlobalIds = {}
) => {
  const startTime = new Date()
  console.log(
    `Migration entity activities started at: ${startTime.toLocaleString()}`
  )
  const activityIds = MAP_EXISTING_ACTIVITY_IDS[programId]
  if (activityIds?.length === 0) {
    return
  }

  // migrating activities
  const activities = await migrationDB
    .selectFrom("entity_activity_date as ea")
    .select([
      "ea.activity_id as id",
      "ea.entity_id",
      "ea.join_date",
      "ea.end_date",
    ])
    .where("ea.entity_id", "in", entityIds)
    .where("ea.activity_id", "in", activityIds ?? [-1])
    .where("ea.deleted_at", "is", null)
    .distinct()
    .execute()

  if (activities.length === 0) {
    return
  }

  const mapActivityIds = await getMapActivityIds(
    programId,
    collect(activities, "id")
  )

  await trx
    .insertInto("ws_entity_activities")
    .values(
      activities.map((activity) => ({
        entity_id: mapGlobalIds[activity.entity_id] ?? 0,
        activity_id: mapActivityIds[activity.id] ?? 0,
        start_date: activity.join_date,
        end_date: activity.end_date,
      }))
    )
    .executeTakeFirst()

  const endTime = new Date()
  console.log(
    `Migration entity activities completed at: ${endTime.toLocaleString()}`
  )
  console.log(`Total duration: ${formatDuration(startTime, endTime)}`)
}
