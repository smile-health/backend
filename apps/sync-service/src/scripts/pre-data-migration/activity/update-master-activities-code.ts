import { IMMUNIZATION } from "../../data-migration/constants/program.js"
import { getMigrationDB } from "../../db.migration.js"

// Mapping of activity ID to code values
const ACTIVITY_CODE_MAPPING: Record<number, string> = {
  1: "rutin",
  2: "bias", 
  3: "ori",
  4: "campaign",
  6: "covid",
  7: "bian",
  11: "extended",
  12: "rabies",
  18: "dengue",
  19: "difteri"
}

export const updateMasterActivitiesCode = async (programId = IMMUNIZATION) => {
  const migrationDB = getMigrationDB(programId)

  try {
    console.log("Starting update of master_activities code column...")

    // Get current activities to see what we're working with
    const currentActivities = await migrationDB
      .selectFrom("master_activities")
      .select(["id", "name", "code"])
      .orderBy("id")
      .execute()

    console.log("Current activities:")
    currentActivities.forEach(activity => {
      console.log(`ID: ${activity.id}, Name: ${activity.name}, Code: ${activity.code || 'NULL'}`)
    })

    let updatedCount = 0

    // Update each activity with its corresponding code
    for (const [activityId, code] of Object.entries(ACTIVITY_CODE_MAPPING)) {
      const id = parseInt(activityId)
      
      // Check if the activity exists
      const activity = await migrationDB
        .selectFrom("master_activities")
        .select(["id", "name"])
        .where("id", "=", id)
        .executeTakeFirst()

      if (activity) {
        // Update the code for this activity
        const result = await migrationDB
          .updateTable("master_activities")
          .set({ code })
          .where("id", "=", id)
          .execute()

        if (result.length > 0 && result[0].numUpdatedRows > 0) {
          console.log(`✓ Updated activity ID ${id} (${activity.name}) with code: ${code}`)
          updatedCount++
        } else {
          console.log(`⚠ No rows updated for activity ID ${id}`)
        }
      } else {
        console.log(`⚠ Activity with ID ${id} not found`)
      }
    }

    // Clear code for activities not in the mapping (set to NULL)
    const activitiesNotInMapping = currentActivities.filter(
      activity => !ACTIVITY_CODE_MAPPING[activity.id] && activity.code !== null
    )

    if (activitiesNotInMapping.length > 0) {
      console.log("\nClearing codes for activities not in mapping:")
      
      for (const activity of activitiesNotInMapping) {
        await migrationDB
          .updateTable("master_activities")
          .set({ code: null })
          .where("id", "=", activity.id)
          .execute()
        
        console.log(`✓ Cleared code for activity ID ${activity.id} (${activity.name})`)
      }
    }

    console.log(`\n✅ Successfully updated ${updatedCount} activities with new codes`)

    // Show final state
    console.log("\nFinal state of activities:")
    const finalActivities = await migrationDB
      .selectFrom("master_activities")
      .select(["id", "name", "code"])
      .orderBy("id")
      .execute()

    finalActivities.forEach(activity => {
      console.log(`ID: ${activity.id}, Name: ${activity.name}, Code: ${activity.code || 'NULL'}`)
    })

  } catch (error) {
    console.error("Error updating master_activities codes:", error)
    throw error
  }
}