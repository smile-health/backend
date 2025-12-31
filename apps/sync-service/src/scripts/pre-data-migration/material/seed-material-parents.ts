import { IMMUNIZATION } from "../../data-migration/constants/program.js"
import { getMigrationDB } from "../../db.migration.js"
import { resetIncrement } from "../../helper.js"
import { materialParents } from "../constants/material-parents.js"
import { sql } from "kysely"

export const seedMaterialParents = async (
  truncate = false,
  programId = IMMUNIZATION
) => {
  const migrationDB = getMigrationDB(programId)

  try {
    // Handle truncate functionality
    if (truncate) {
      console.log("Truncating existing material parents (kfa_level_id = 2)...")

      // Get all parent material IDs before deletion for cleanup
      const parentMaterials = await migrationDB
        .selectFrom("master_materials")
        .select("id")
        .where("kfa_level_id", "=", 2)
        .execute()

      const parentIds = parentMaterials.map((pm) => pm.id)

      // Delete from master_material_has_activities for parent materials
      if (parentIds.length > 0) {
        await migrationDB
          .deleteFrom("master_material_has_activities")
          .where("master_material_id", "in", parentIds)
          .execute()
        console.log(
          `Deleted ${parentIds.length} activity associations for parent materials`
        )
      }

      // Delete all materials with kfa_level_id = 2
      await migrationDB
        .deleteFrom("master_materials")
        .where("kfa_level_id", "=", 2)
        .execute()

      console.log("Deleted existing material parents (kfa_level_id = 2)")

      // Reset auto increment for master_materials table
      await resetIncrement(migrationDB, "master_materials")
      await resetIncrement(migrationDB, "master_material_has_activities")
      console.log(
        "Reset auto increment for master_materials and master_material_has_activities table"
      )
    }

    console.log("Starting material parents seeding...")

    await migrationDB.transaction().execute(async (trx) => {
      // Disable foreign key checks to allow insertion of materials with non-existent users
      await sql`SET FOREIGN_KEY_CHECKS = 0`.execute(trx)

      // Loop through each parent configuration
      for (const parentConfig of materialParents) {
        console.log(`Processing parent: ${parentConfig.description}`)

        // Get the first child ID
        const firstChildId = parentConfig.children_ids[0]
        if (!firstChildId) {
          console.log(
            `No children found for ${parentConfig.description}, skipping...`
          )
          continue
        }

        // Get the child material data to base the parent on
        const childMaterial = await trx
          .selectFrom("master_materials")
          .select([
            "id",
            "name",
            "description",
            "kfa_level_id",
            "code",
            "kfa_code",
            "unit",
            "unit_of_distribution",
            "pieces_per_unit",
            "temperature_sensitive",
            "temperature_min",
            "temperature_max",
            "is_vaccine",
            "is_openvial",
            "managed_in_batch",
            "status",
            "is_so",
            "parent_id",
            "created_by",
            "updated_by",
            "deleted_by",
            "created_at",
            "updated_at",
            "deleted_at",
          ])
          .where("id", "=", firstChildId)
          .executeTakeFirst()

        if (!childMaterial) {
          console.log(`Child material ${firstChildId} not found, skipping...`)
          continue
        }

        // Create parent material data with modified properties
        const parentMaterialData = {
          name: `${childMaterial.name} (Template)`,
          description: parentConfig.description,
          kfa_level_id: 2, // Set as requested
          code: childMaterial.code,
          kfa_code: parentConfig.kfa_code,
          unit: childMaterial.unit,
          unit_of_distribution: childMaterial.unit_of_distribution,
          pieces_per_unit: childMaterial.pieces_per_unit,
          temperature_sensitive: childMaterial.temperature_sensitive,
          temperature_min: childMaterial.temperature_min,
          temperature_max: childMaterial.temperature_max,
          is_vaccine: childMaterial.is_vaccine,
          is_openvial: childMaterial.is_openvial,
          managed_in_batch: childMaterial.managed_in_batch,
          status: childMaterial.status,
          is_so: childMaterial.is_so,
          parent_id: null, // Parent has no parent
          created_by: childMaterial.created_by,
          updated_by: childMaterial.updated_by,
          deleted_by: childMaterial.deleted_by,
          created_at: childMaterial.created_at,
          updated_at: childMaterial.updated_at,
          deleted_at: childMaterial.deleted_at,
        }

        // Insert the parent material
        const insertResult = await trx
          .insertInto("master_materials")
          .values(parentMaterialData)
          .executeTakeFirst()

        const parentId = Number(insertResult.insertId)
        console.log(`Inserted parent material with ID: ${parentId}`)

        // Get unique activity_ids from all children
        const childActivityIds = await trx
          .selectFrom("master_material_has_activities")
          .select("activity_id")
          .where("master_material_id", "in", parentConfig.children_ids)
          .distinct()
          .execute()

        // Insert activity associations for the parent
        if (childActivityIds.length > 0) {
          const activityAssociations = childActivityIds.map((activity) => ({
            master_material_id: parentId,
            activity_id: activity.activity_id,
          }))

          await trx
            .insertInto("master_material_has_activities")
            .values(activityAssociations)
            .execute()

          console.log(
            `Inserted ${activityAssociations.length} activity associations for parent ${parentId}`
          )
        } else {
          console.log(
            `No activity associations found for children of parent ${parentId}`
          )
        }

        // Update all children to have this parent as their parent_id
        await trx
          .updateTable("master_materials")
          .set({
            parent_id: parentId,
            kfa_level_id: 3,
          })
          .where("id", "in", parentConfig.children_ids)
          .execute()
      }

      // Re-enable foreign key checks
      await sql`SET FOREIGN_KEY_CHECKS = 1`.execute(trx)

      console.log(`Material parents seeding completed successfully`)
    })
  } catch (error) {
    console.error("Error in seedMaterialParents:", error)
    throw error
  }
}
