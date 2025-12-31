import { IMMUNIZATION } from "../../data-migration/constants/program.js";
import { getMigrationDB } from "../../db.migration.js";
import { materialChildren } from "../constants/material-children.js";

export const updateMaterialChildren = async (programId = IMMUNIZATION) => {
  const migrationDB = getMigrationDB(programId)

  try {
    console.log("Starting material children update...")

    let updatedCount = 0
    let skippedCount = 0

    // Loop through each material child configuration
    for (const materialChild of materialChildren) {
      console.log(`Processing material ID: ${materialChild.id}`)

      // Build update object with only non-null values
      const updateData: {
        name?: string
        kfa_code?: string
        description?: string
        updated_at: Date
      } = {
        updated_at: new Date(),
      }
      let hasUpdates = false

      if (materialChild.name !== null) {
        updateData.name = materialChild.name
        hasUpdates = true
      }

      if (materialChild.kfa_code !== null) {
        updateData.kfa_code = materialChild.kfa_code
        hasUpdates = true
      }

      if (materialChild.description !== null) {
        updateData.description = materialChild.description
        hasUpdates = true
      }

      // Skip if no valid updates
      if (!hasUpdates) {
        console.log(`Skipping material ${materialChild.id} - all values are null`)
        skippedCount++
        continue
      }

      // Update the material in the database
      await migrationDB
        .updateTable("master_materials")
        .set(updateData)
        .where("id", "=", materialChild.id)
        .execute()

      // Log the update (Kysely doesn't provide numUpdatedRows directly)
      // We'll assume success if no error was thrown
      console.log(`Updated material ${materialChild.id} with:`, updateData)
      updatedCount++

      // adjust material activity, to prevent zero value material_id on 5.0
      if (materialChild.activity_ids && materialChild.activity_ids.length > 0) {
        for (const activityId of materialChild.activity_ids) {
          await migrationDB
            .insertInto("master_material_has_activities")
            .values({
              master_material_id: materialChild.id,
              activity_id: activityId,
              created_at: new Date(),
              updated_at: new Date(),
            })
            .onDuplicateKeyUpdate({
              updated_at: new Date(),
            })
            .execute()
          console.log(`Inserted/Updated material_id ${materialChild.id} with activity_id ${activityId}`)
        }
      }
    }

    console.log("Material children update completed!")
    console.log(`📊 Summary:`)
    console.log(`   - Updated: ${updatedCount} records`)
    console.log(`   - Skipped: ${skippedCount} records`)

  } catch (error) {
    console.error("Error in updateMaterialChildren:", error)
    throw error
  }
}
