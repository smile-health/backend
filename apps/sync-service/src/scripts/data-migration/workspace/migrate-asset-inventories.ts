import { collect } from "@smile/lib/utils.js"
import { getMigrationDB } from "../../db.migration_iot.js"
import { db } from "../../db.platform.js"
import {
  deleteTableMapping,
  getMapAssetModelIds,
  getMapAssetTypeIds,
  getMapAssetVendorTypeIds,
  getMapBudgetSourceIds,
  getMapEntityIds,
  getMapManufactureIds,
  getMapUserIds,
  insertTableMapping,
  resetIncrement,
} from "../../helper.js"
import { MAP_EXISTING_TO_PLATFORM } from "../const.js"
import { IMMUNIZATION } from "../constants/program.js"

const formatDuration = (startTime: Date, endTime: Date): string => {
  const durationMs = endTime.getTime() - startTime.getTime()
  const hours = Math.floor(durationMs / (1000 * 60 * 60))
  const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60))
  const seconds = Math.floor((durationMs % (1000 * 60)) / 1000)
  return `${hours}h ${minutes}m ${seconds}s`
}

const mapWorkingStatusId = (workingStatusId: number | null): number => {
  if (!workingStatusId) return 1

  const workingStatusMapping: Record<number, number> = {
    1: 1,
    2: 2,
    3: 3,
    4: 4,
    5: 4,
    7: 2,
    9: 5,
  }

  return workingStatusMapping[workingStatusId] || 1
}

type MigrationAssetInventoryDTO = {
  id: number
  program_id: number
  asset_model_id: number | null
  asset_type_id: number | null
  manufacture_id: number | null
  serial_number: string
  production_year: number
  asset_working_status_id: number | null
  entity_id: number | null
  contact_person_user_1_name: string
  contact_person_user_2_name: string | null
  contact_person_user_3_name: string | null
  ownership_status: number
  borrowed_from_entity_id: number | null
  budget_year: number
  budget_source_id: number | null
  asset_electricity_id: number | null
  warranty_start_date: Date | null
  warranty_end_date: Date | null
  warranty_asset_vendor_id: number | null
  calibration_last_date: Date | null
  calibration_schedule_id: number | null
  calibration_asset_vendor_id: number | null
  maintenance_last_date: Date | null
  maintenance_schedule_id: number | null
  maintenance_asset_vendor_id: number | null
  status: number
  created_by: number | null
  updated_by: number | null
  created_at: Date
  updated_at: Date
  contact_person_user_1_number: string
  contact_person_user_2_number: string | null
  contact_person_user_3_number: string | null
  ownership_qty: number
  other_asset_model_name: string | null
  other_net_capacity: number | null
  other_gross_capacity: number | null
  other_asset_type_name: string | null
  other_min_temperature: number | null
  other_max_temperature: number | null
  other_manufacture_name: string | null
  other_budget_source_name: string | null
}

export const migrateAssetInventories = async (
  programId = 1,
  truncate = false
) => {
  const startTime = new Date()
  console.info(
    `Asset inventories migration started at: ${startTime.toLocaleString()}`
  )

  const migrationDB = getMigrationDB(programId)
  
  let assetInventoryCount = 0

  if (truncate && programId === IMMUNIZATION) {
    console.log("Truncating immunization asset inventory tables...")
    await deleteAssetInventoryRelations(programId)
  }

  try {
    const existingAssetInventories = await migrationDB
      .selectFrom("assets")
      .selectAll()
      .where("deleted_at", "is", null)
      .execute()

    if (existingAssetInventories.length === 0) {
      console.info("No asset inventories found to migrate")
      return
    }

    console.info(
      `Found ${existingAssetInventories.length} asset inventories to migrate`
    )

    await db.transaction().execute(async (trx) => {
      const existingCreatedByIds = collect(
        existingAssetInventories,
        "created_by"
      )
      const existingUpdatedByIds = collect(
        existingAssetInventories,
        "updated_by"
      )
      const [mappedUserCreatedByIds, mappedUserUpdatedByIds] =
        await Promise.all([
          getMapUserIds(programId, existingCreatedByIds),
          getMapUserIds(programId, existingUpdatedByIds),
        ])

      // Get mapping for asset models (from model_id field)
      const assetModelIds = [
        ...new Set(
          existingAssetInventories.map((ai) => ai.model_id).filter(Boolean)
        ),
      ]
      const mapAssetModelIds = await getMapAssetModelIds(
        programId,
        assetModelIds
      )

      // Get mapping for asset types (from type_id field)
      const assetTypeIds = [
        ...new Set(
          existingAssetInventories.map((ai) => ai.type_id).filter(Boolean)
        ),
      ]
      const mapAssetTypeIds = await getMapAssetTypeIds(programId, assetTypeIds)

      // Get mapping for manufactures
      const manufactureIds = [
        ...new Set(
          existingAssetInventories
            .map((ai) => ai.manufacture_id)
            .filter(Boolean)
        ),
      ]
      const mapManufactureIds = await getMapManufactureIds(
        programId,
        manufactureIds
      )

      // Get mapping for entities (including borrowed_from field)
      const entityIds = [
        ...new Set(
          existingAssetInventories
            .map((ai) => ai.entity_id)
            .filter(Boolean)
            .concat(
              existingAssetInventories
                .map((ai) => ai.borrowed_from)
                .filter(Boolean)
            )
        ),
      ]
      const mapEntityIds = await getMapEntityIds(programId, entityIds)

      // Get mapping for vendors
      const vendorIds = [
        ...new Set(
          existingAssetInventories.map((ai) => ai.vendor_id).filter(Boolean)
        ),
      ]
      const mapVendorIds = await getMapAssetVendorTypeIds(programId, vendorIds)

      // Get mapping for budget sources (from budget_src field)
      const budgetSourceIds = [
        ...new Set(
          existingAssetInventories.map((ai) => ai.budget_src).filter(Boolean)
        ),
      ]
      const mapBudgetSourceIds = await getMapBudgetSourceIds(
        programId,
        budgetSourceIds
      )

      // Log missing mappings
      const missingAssetModelIds = assetModelIds.filter(
        (id) => !mapAssetModelIds[id]
      )
      const missingAssetTypeIds = assetTypeIds.filter(
        (id) => !mapAssetTypeIds[id]
      )
      const missingManufactureIds = manufactureIds.filter(
        (id) => !mapManufactureIds[id]
      )
      const missingEntityIds = entityIds.filter((id) => !mapEntityIds[id])
      const missingVendorIds = vendorIds.filter((id) => !mapVendorIds[id])
      const missingBudgetSourceIds = budgetSourceIds.filter(
        (id) => !mapBudgetSourceIds[id]
      )

      if (missingAssetModelIds.length > 0) {
        console.warn(
          `⚠️  Missing asset model mappings for IDs: ${missingAssetModelIds.join(", ")}`
        )
      }
      if (missingAssetTypeIds.length > 0) {
        console.warn(
          `⚠️  Missing asset type mappings for IDs: ${missingAssetTypeIds.join(", ")}`
        )
      }
      if (missingManufactureIds.length > 0) {
        console.warn(
          `⚠️  Missing manufacture mappings for IDs: ${missingManufactureIds.join(", ")}`
        )
      }
      if (missingEntityIds.length > 0) {
        console.warn(
          `⚠️  Missing entity mappings for IDs: ${missingEntityIds.join(", ")}`
        )
      }
      if (missingVendorIds.length > 0) {
        console.warn(
          `⚠️  Missing vendor mappings for IDs: ${missingVendorIds.join(", ")}`
        )
      }
      if (missingBudgetSourceIds.length > 0) {
        console.warn(
          `⚠️  Missing budget source mappings for IDs: ${missingBudgetSourceIds.join(", ")}`
        )
      }

      const processedAssetInventories: MigrationAssetInventoryDTO[] =
        existingAssetInventories.map((ai) => ({
          id: ai.id,
          program_id: programId,
          asset_model_id: ai.model_id
            ? mapAssetModelIds[ai.model_id] || null
            : null,
          asset_type_id: ai.type_id
            ? mapAssetTypeIds[ai.type_id] || null
            : null,
          manufacture_id: ai.manufacture_id
            ? mapManufactureIds[ai.manufacture_id] || null
            : null,
          serial_number: ai.serial_number || "",
          production_year: ai.prod_year || 0,
          asset_working_status_id: mapWorkingStatusId(ai.working_status_id),
          entity_id: ai.entity_id ? mapEntityIds[ai.entity_id] || null : null,
          contact_person_user_1_name: ai.contact_person_user_1_name || "",
          contact_person_user_2_name: ai.contact_person_user_2_name || null,
          contact_person_user_3_name: ai.contact_person_user_3_name || null,
          ownership_status: ai.ownership_status || 1,
          borrowed_from_entity_id:
            ai.ownership_status === 2 && ai.borrowed_from
              ? mapEntityIds[ai.borrowed_from] || null
              : null,
          budget_year: ai.budget_year || 0,
          budget_source_id: ai.budget_src
            ? mapBudgetSourceIds[ai.budget_src] || null
            : null,
          asset_electricity_id: ai.electricity_available_id || null,
          warranty_start_date: ai.warranty_start_date || null,
          warranty_end_date: ai.warranty_end_date || null,
          warranty_asset_vendor_id: ai.vendor_id
            ? mapVendorIds[ai.vendor_id] || null
            : null,
          calibration_last_date: ai.last_calibration_date || null,
          calibration_schedule_id: ai.calibration_schedule_id || null,
          calibration_asset_vendor_id: ai.calibration_asset_vendor_id || null,
          maintenance_last_date: ai.maintenance_last_date || null,
          maintenance_schedule_id: ai.maintenance_schedule_id || null,
          maintenance_asset_vendor_id: ai.maintenance_asset_vendor_id || null,
          status: ai.status || 1,
          created_by: mappedUserCreatedByIds[ai.created_by ?? 0] || null,
          updated_by: mappedUserUpdatedByIds[ai.updated_by ?? 0] || null,
          created_at: ai.created_at || new Date(),
          updated_at: ai.updated_at || new Date(),
          contact_person_user_1_number: ai.contact_person_user_1_number || "",
          contact_person_user_2_number: ai.contact_person_user_2_number || null,
          contact_person_user_3_number: ai.contact_person_user_3_number || null,
          ownership_qty: ai.ownership_qty || 1,
          other_asset_model_name: ai.other_model_asset || null,
          other_net_capacity: ai.other_capacity_nett || null,
          other_gross_capacity: ai.other_capacity_gross || null,
          other_asset_type_name: ai.other_type_asset || null,
          other_min_temperature: ai.other_min_temp || null,
          other_max_temperature: ai.other_max_temp || null,
          other_manufacture_name: ai.other_manufacture || null,
          other_budget_source_name: ai.other_budget_src,
        }))

      if (processedAssetInventories.length > 0) {
        await trx
          .insertInto("ws_asset_inventories")
          .values(processedAssetInventories)
          .execute()

        assetInventoryCount = processedAssetInventories.length
        console.info(`Inserted ${assetInventoryCount} asset inventories`)

        const mapExistingToPlatform = processedAssetInventories.reduce(
          (acc, item) => {
            acc[item.id] = item.id
            return acc
          },
          {} as Record<number, number>
        )

        await insertTableMapping("assets", programId, mapExistingToPlatform)
        console.info(
          `Inserted mapping for ${assetInventoryCount} asset inventories`
        )
      }
    })

    const endTime = new Date()
    const duration = formatDuration(startTime, endTime)

    console.info(
      `\n🎉 Asset inventories migration finished at: ${endTime.toLocaleString()}`
    )
    console.info(`📊 Total duration: ${duration}`)
    console.info(`📈 Summary:`)
    console.info(
      `   - ws_asset_inventories: ${assetInventoryCount} rows inserted`
    )
    console.info("✅ Asset inventories migration completed successfully")
    process.exit(0)
  } catch (error) {
    console.error("❌ Error during asset inventories migration")
    console.error(error)
    process.exit(1)
  }
}

export const deleteAssetInventoryRelations = async (
  programId = IMMUNIZATION
) => {
  const platformProgramIds = MAP_EXISTING_TO_PLATFORM[programId]
  if (!platformProgramIds) return

  await db
    .deleteFrom("ws_asset_inventories")
    .where("program_id", "in", platformProgramIds)
    .execute()

  // Reset auto increment for deleted tables
  await resetIncrement(db, "ws_asset_inventories")
  await deleteTableMapping("assets", platformProgramIds)
}
