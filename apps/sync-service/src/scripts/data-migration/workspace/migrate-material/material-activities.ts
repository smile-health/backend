import { collect } from "@smile-health/lib/utils.js"
import { Kysely, Transaction } from "kysely"
import { getMapActivityIds } from "../../../helper.js"
import { MigrationDB } from "../../../types.js"
import { DB } from "../../../types.platform.js"

export const migrateMaterialActivities = async (
  trx: Transaction<DB>,
  migrationDB: Kysely<MigrationDB>,
  programId: number,
  materialIds: number[],
  mapGlobalIds = {}
) => {
  // migrating activities
  const activities = await migrationDB
    .selectFrom("master_material_has_activities as ma")
    .innerJoin("master_materials as m", "m.id", "ma.master_material_id")
    .innerJoin("master_activities as a", "a.id", "ma.activity_id")
    .select([
      "master_material_id",
      "activity_id",
      "m.need_sequence",
      "a.is_patient_id",
    ])
    .where("ma.master_material_id", "in", materialIds)
    .execute()

  if (activities.length === 0) {
    return
  }

  const mapActivityIds = await getMapActivityIds(
    programId,
    collect(activities, "activity_id")
  )
  const filteredActivities = activities.filter((activity) => {
    return mapActivityIds[activity.activity_id ?? 0] !== undefined
  })

  if (filteredActivities.length === 0) {
    console.log("no material activities to map")
    return
  }

  await trx
    .insertInto("ws_material_activities")
    .values(
      filteredActivities.map((activity) => ({
        material_id: mapGlobalIds[activity.master_material_id ?? 0] ?? 0,
        activity_id: mapActivityIds[activity.activity_id ?? 0] ?? 0,
        is_sequence: Number(activity.need_sequence),
        is_patient_needed: Number(activity.is_patient_id),
      }))
    )
    .executeTakeFirst()
}
