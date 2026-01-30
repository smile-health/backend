import { db as syncDB } from "@/common/infrastructure/database/index.js"
import { db } from "@/scripts/db.platform.js"
import { getMigrationDB } from "../../db.migration.js"
import { collect } from "@smile-health/lib/utils.js"

const MAP_MATERIAL_UNIT_CONSUMPTION = {
  pcs: 1,
  doses: 2,
  ml: 3,
  tablet: 4,
  gram: 5,
  box: 6,
  vial: 7,
  wrap: 8,
  pack: 9,
  cc: 10,
  ampul: 11,
  kapsul: 13,
  botol: 14,
  unit: 15,
  tube: 17,
  kit: 18,
  sachet: 19,
  jerigen: 20,
  test: 21,
  pasang: 22,
  strip: 23,
  set: 24,

  // Legacy mappings for backward compatibility
  buah: 1, // maps to pcs
  dosis: 2, // maps to doses
}

const formatDuration = (startTime: Date, endTime: Date): string => {
  const durationMs = endTime.getTime() - startTime.getTime()
  const hours = Math.floor(durationMs / (1000 * 60 * 60))
  const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60))
  const seconds = Math.floor((durationMs % (1000 * 60)) / 1000)
  return `${hours}h ${minutes}m ${seconds}s`
}

export const updateMaterialUnits = async (limit: number = 0, programId = 1) => {
  const startTime = new Date()
  console.info(
    `Update material units started at: ${startTime.toLocaleString()}`
  )

  console.info("updating material units...")

  const migrationDB = getMigrationDB(programId)

  let updatedCount = 0
  try {
    await db.transaction().execute(async (trx) => {
      // Get source materials with their units
      const sourceMaterials = await migrationDB
        .selectFrom("master_materials")
        .select(["id", "name", "unit", "unit_of_distribution"])
        .where("deleted_at", "is", null)
        .$if(limit > 0, (qb) => qb.limit(limit))
        .orderBy("id")
        .execute()

      console.info(`Processing ${sourceMaterials.length} source materials`)

      // Get mapping from source material IDs to target material IDs
      const sourceMaterialIds = collect(sourceMaterials, "id")
      const materialMappings = await syncDB
        .selectFrom("mapping_materials")
        .select(["existing_material_id", "platform_global_id"])
        .distinct()
        .where("existing_material_id", "in", sourceMaterialIds)
        .execute()

      const materialIdMap = materialMappings.reduce(
        (acc, mapping) => {
          if (mapping.platform_global_id) {
            acc[mapping.existing_material_id] = mapping.platform_global_id
          }
          return acc
        },
        {} as Record<number, number>
      )

      for (const sourceMaterial of sourceMaterials) {
        const targetMaterialId = materialIdMap[sourceMaterial.id]

        if (!targetMaterialId) {
          console.warn(
            `No target material found for source material ID: ${sourceMaterial.id}`
          )
          continue
        }

        console.info(
          `Processing material ${sourceMaterial.id} -> ${targetMaterialId}`
        )

        // Map consumption unit
        const unitKey = sourceMaterial.unit?.toLowerCase()
        let unitOfConsumptionId = unitKey
          ? MAP_MATERIAL_UNIT_CONSUMPTION[unitKey]
          : undefined
        if (!unitOfConsumptionId) {
          console.warn(
            `Unknown consumption unit: ${sourceMaterial.unit} for material ${sourceMaterial.id}, using default (dosis)`
          )
          unitOfConsumptionId = MAP_MATERIAL_UNIT_CONSUMPTION["dosis"]
        }

        // Update target material
        const updateResult = await trx
          .updateTable("materials")
          .set({
            unit_of_consumption_id: unitOfConsumptionId,
            updated_at: new Date(),
          })
          .where("id", "=", targetMaterialId)
          .executeTakeFirst()

        if (updateResult.numUpdatedRows > 0) {
          updatedCount++
          console.info(
            `Updated material ${targetMaterialId}: consumption_unit=${unitOfConsumptionId} (${sourceMaterial.unit})`
          )
        } else {
          console.warn(`Failed to update material ${targetMaterialId}`)
        }
      }
    })

    const endTime = new Date()
    const duration = formatDuration(startTime, endTime)

    console.info(
      `\n🎉 Update material units finished at: ${endTime.toLocaleString()}`
    )
    console.info(`📊 Total duration: ${duration}`)
    console.info(`📈 Summary:`)
    console.info(`   - Materials Updated: ${updatedCount} records`)
    console.info("✅ Material units update completed successfully")
    process.exit(0)
  } catch (error) {
    console.error("❌ Material units update failed:")
    console.error(error)
    process.exit(1)
  }
}
