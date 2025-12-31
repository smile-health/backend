import { db } from "../../db.platform.js"
import { db as syncDB } from "@/common/infrastructure/database/index.js"
import {
  workspacesData,
  entityTagsData,
  entityTypesData,
  materialLevelsData,
  materialTypesData,
  materialUnitsData,
  mappingActivitiesData,
  manufactureTypesData,
  reconciliationActionsData,
  reconciliationReasonsData,
} from "../constants/index.js"

const formatDuration = (startTime: Date, endTime: Date): string => {
  const durationMs = endTime.getTime() - startTime.getTime()
  const hours = Math.floor(durationMs / (1000 * 60 * 60))
  const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60))
  const seconds = Math.floor((durationMs % (1000 * 60)) / 1000)
  return `${hours}h ${minutes}m ${seconds}s`
}

export const migrateGlobalData = async () => {
  const startTime = new Date()
  console.info(
    `Migration global data started at: ${startTime.toLocaleString()}`
  )

  try {
    // Step 1: Migrate workspaces
    console.info("=== Step 1: Migrating workspaces ===")
    console.info(`migrating ${workspacesData.length} workspaces`)

    for (const workspace of workspacesData) {
      console.info(`migrating workspace ${workspace.id} - ${workspace.name}`)

      await db
        .insertInto("workspaces")
        .values({
          id: workspace.id,
          key: workspace.key,
          name: workspace.name,
          config: workspace.config,
          created_at: workspace.created_at,
          updated_at: workspace.updated_at,
          program_uuid: workspace.program_uuid,
          description: workspace.description,
          deleted_at: workspace.deleted_at,
          created_by: workspace.created_by,
          updated_by: workspace.updated_by,
          deleted_by: workspace.deleted_by,
        })
        .onDuplicateKeyUpdate({
          key: workspace.key,
          name: workspace.name,
          config: workspace.config,
          updated_at: workspace.updated_at,
          program_uuid: workspace.program_uuid,
          description: workspace.description,
          deleted_at: workspace.deleted_at,
          updated_by: workspace.updated_by,
          deleted_by: workspace.deleted_by,
        })
        .execute()
    }
    console.info("✅ Workspaces migration completed")

    // Step 2: Migrate entity tags
    console.info("=== Step 2: Migrating entity tags ===")
    console.info(`migrating ${entityTagsData.length} entity tags`)

    for (const entityTag of entityTagsData) {
      console.info(`migrating entity tag ${entityTag.id} - ${entityTag.title}`)

      await db
        .insertInto("entity_tags")
        .values({
          id: entityTag.id,
          title: entityTag.title,
          created_at: entityTag.created_at,
          updated_at: entityTag.updated_at,
          deleted_at: entityTag.deleted_at,
          integration_type: entityTag.integration_type,
          external_properties: entityTag.external_properties,
          is_open_vial: entityTag.is_open_vial,
        })
        .onDuplicateKeyUpdate({
          title: entityTag.title,
          updated_at: entityTag.updated_at,
          integration_type: entityTag.integration_type,
          external_properties: entityTag.external_properties,
          is_open_vial: entityTag.is_open_vial,
        })
        .execute()
    }
    console.info("✅ Entity tags migration completed")

    // Step 3: Migrate entity types
    console.info("=== Step 3: Migrating entity types ===")
    console.info(`migrating ${entityTypesData.length} entity types`)

    for (const entityType of entityTypesData) {
      console.info(
        `migrating entity type ${entityType.id} - ${entityType.name}`
      )

      await db
        .insertInto("entity_types")
        .values({
          id: entityType.id,
          name: entityType.name,
          created_at: entityType.created_at,
          updated_at: entityType.updated_at,
          deleted_at: entityType.deleted_at,
          integration_type: entityType.integration_type,
          external_properties: entityType.external_properties,
        })
        .onDuplicateKeyUpdate({
          name: entityType.name,
          updated_at: entityType.updated_at,
          integration_type: entityType.integration_type,
          external_properties: entityType.external_properties,
        })
        .execute()
    }
    console.info("✅ Entity types migration completed")

    // Step 4: Migrate material levels
    console.info("=== Step 4: Migrating material levels ===")
    console.info(`migrating ${materialLevelsData.length} material levels`)

    for (const materialLevel of materialLevelsData) {
      console.info(
        `migrating material level ${materialLevel.id} - ${materialLevel.name}`
      )

      await db
        .insertInto("material_levels")
        .values(materialLevel)
        .onDuplicateKeyUpdate({
          name: materialLevel.name,
          updated_at: materialLevel.updated_at,
        })
        .execute()
    }
    console.info("✅ Material levels migration completed")

    // Step 5: Migrate material types
    console.info("=== Step 5: Migrating material types ===")
    console.info(`migrating ${materialTypesData.length} material types`)

    for (const materialType of materialTypesData) {
      console.info(
        `migrating material type ${materialType.id} - ${materialType.name}`
      )

      await db
        .insertInto("material_types")
        .values(materialType)
        .onDuplicateKeyUpdate({
          name: materialType.name,
          updated_at: materialType.updated_at,
        })
        .execute()
    }
    console.info("✅ Material types migration completed")

    // Step 7: Migrate manufacture types
    console.info("=== Step 7: Migrating manufacture types ===")
    console.info(`migrating ${manufactureTypesData.length} manufacture types`)

    for (const manufactureType of manufactureTypesData) {
      console.info(
        `migrating manufacture type ${manufactureType.id} - ${manufactureType.name}`
      )

      await db
        .insertInto("manufacture_types")
        .values(manufactureType)
        .onDuplicateKeyUpdate({
          name: manufactureType.name,
          updated_at: manufactureType.updated_at,
        })
        .execute()
    }
    console.info("✅ Manufacture types migration completed")

    // Step 8: Migrate reconciliation actions and reasons with workspace relationships
    console.info("=== Step 8: Migrating reconciliation master data ===")
    console.info(
      `migrating ${reconciliationActionsData.length} reconciliation actions`
    )
    console.info(
      `migrating ${reconciliationReasonsData.length} reconciliation reasons`
    )

    // First, migrate the base reconciliation actions
    for (const reconciliationAction of reconciliationActionsData) {
      console.info(
        `migrating reconciliation action ${reconciliationAction.id} - ${reconciliationAction.title}`
      )

      await db
        .insertInto("reconciliation_actions")
        .values(reconciliationAction)
        .onDuplicateKeyUpdate({
          title: reconciliationAction.title,
        })
        .execute()
    }

    // Then, migrate the base reconciliation reasons
    for (const reconciliationReason of reconciliationReasonsData) {
      console.info(
        `migrating reconciliation reason ${reconciliationReason.id} - ${reconciliationReason.title}`
      )

      await db
        .insertInto("reconciliation_reasons")
        .values(reconciliationReason)
        .onDuplicateKeyUpdate({
          title: reconciliationReason.title,
        })
        .execute()
    }

    // Create workspace relationships for reconciliation actions and reasons
    const reconciliationActionWs = workspacesData.flatMap(({ id }) =>
      reconciliationActionsData.map((action) => ({
        reconciliation_action_id: action.id,
        workspace_id: id,
      }))
    )

    const reconciliationReasonWs = workspacesData.flatMap(({ id }) =>
      reconciliationReasonsData.map((reason) => ({
        reconciliation_reason_id: reason.id,
        workspace_id: id,
      }))
    )

    await db
      .insertInto("reconciliation_actions_workspaces")
      .values(reconciliationActionWs)
      .onDuplicateKeyUpdate({
        workspace_id: (eb) => eb.ref("workspace_id"),
      })
      .execute()

    await db
      .insertInto("reconciliation_reasons_workspaces")
      .values(reconciliationReasonWs)
      .onDuplicateKeyUpdate({
        workspace_id: (eb) => eb.ref("workspace_id"),
      })
      .execute()

    console.info("✅ Reconciliation master data migration completed")

    // Step 9: Migrate export categories for workspaces
    console.info("=== Step 9: Migrating export categories ===")
    const exportCategoryProgramNonHierarchy = [1, 2, 3, 4, 5, 6, 7]
    const exportCategoryProgramHierarchy = [1, 2, 3, 4, 5]

    let exportCategoriesCount = 0
    for (const workspace of workspacesData) {
      console.info(
        `migrating export categories for workspace ${workspace.id} - ${workspace.name}`
      )

      const exportCategories = workspace.config?.material?.is_hierarchy_enabled
        ? exportCategoryProgramHierarchy
        : exportCategoryProgramNonHierarchy

      const exportCategoriesSave = exportCategories.map((id) => ({
        export_category_id: id,
        program_id: workspace.id,
      }))

      await db
        .insertInto("ws_export_categories")
        .values(exportCategoriesSave)
        .onDuplicateKeyUpdate({
          export_category_id: (eb) => eb.ref("export_category_id"),
        })
        .execute()

      exportCategoriesCount += exportCategoriesSave.length
    }
    console.info("✅ Export categories migration completed")

    const endTime = new Date()
    const duration = formatDuration(startTime, endTime)

    console.info(
      `\n🎉 Migration global data finished at: ${endTime.toLocaleString()}`
    )
    console.info(`📊 Total duration: ${duration}`)
    console.info(`📈 Summary:`)
    console.info(`   - Workspaces: ${workspacesData.length} records`)
    console.info(`   - Entity Tags: ${entityTagsData.length} records`)
    console.info(`   - Entity Types: ${entityTypesData.length} records`)
    console.info(`   - Material Levels: ${materialLevelsData.length} records`)
    console.info(`   - Material Types: ${materialTypesData.length} records`)
    console.info(`   - Material Units: ${materialUnitsData.length} records`)
    console.info(
      `   - Manufacture Types: ${manufactureTypesData.length} records`
    )
    console.info(
      `   - Reconciliation Actions: ${reconciliationActionsData.length} records`
    )
    console.info(
      `   - Reconciliation Reasons: ${reconciliationReasonsData.length} records`
    )
    console.info(
      `   - Reconciliation Actions Workspaces: ${workspacesData.length * reconciliationActionsData.length} records`
    )
    console.info(
      `   - Reconciliation Reasons Workspaces: ${workspacesData.length * reconciliationReasonsData.length} records`
    )
    console.info(`   - Export Categories: ${exportCategoriesCount} records`)
    console.info("✅ All global data migration completed successfully")
    process.exit(0)
  } catch (error) {
    console.error("migration failed")
    console.error(error)
    process.exit(1)
  }
}
