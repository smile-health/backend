import { collect } from "@smile-health/lib/utils.js"
import { Selectable, Transaction } from "kysely"
import { getMigrationDB } from "../../db.migration_iot.js"
import { db } from "../../db.platform.js"
import {
  getMapAssetTypeIds,
  getMapGlobalManufactureIds,
  getMapGlobalUserIds,
  getMapUserIds,
  insertTableMapping,
} from "../../helper.js"
import { AssetTypes, DB as PlatformDB } from "../../types.platform.js"
import { MAP_EXISTING_TO_PLATFORM } from "../const.js"

// Asset vendor type mapping constant
const ASSET_VENDOR_TYPE_MAPPING: Record<string, number> = {
  supplier: 1,
  manufacturer: 2,
  distributor: 3,
  service_provider: 4,
  default: 1,
}

type MigrationAssetTypeDTO = Partial<Selectable<AssetTypes>>
type MigrationAssetModelDTO = {
  id: number
  name: string | null
  capacity: number | null
  created_at: Date
  updated_at: Date
  created_by: number | null
  updated_by: number | null
  capacity_gross: number | null
  capacity_nett: number | null
  capacity_gross_2: number | null
  capacity_nett_2: number | null
  capacity_gross_3: number | null
  capacity_nett_3: number | null
  asset_type_id: number | null
  manufacture_id: number | null
}

type MigrationAssetVendorDTO = {
  id: number
  name: string | null
  type: string | null
  description: string | null
  created_at: Date
  updated_at: Date
  created_by: number | null
  updated_by: number | null
}

const formatDuration = (startTime: Date, endTime: Date): string => {
  const durationMs = endTime.getTime() - startTime.getTime()
  const hours = Math.floor(durationMs / (1000 * 60 * 60))
  const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60))
  const seconds = Math.floor((durationMs % (1000 * 60)) / 1000)
  return `${hours}h ${minutes}m ${seconds}s`
}

export const migrateAssets = async (programId = 1) => {
  const startTime = new Date()
  console.info(`Migration assets started at: ${startTime.toLocaleString()}`)
  console.info("migrating assets...", programId)

  const migrationDB = getMigrationDB(programId)

  let assetTypeCount = 0
  let assetTypeWorkspaceCount = 0
  let assetModelCount = 0
  let assetModelWorkspaceCount = 0
  let assetVendorCount = 0
  let assetVendorWorkspaceCount = 0
  try {
    await db.transaction().execute(async (trx) => {
      // First, ensure asset vendor types exist
      await ensureAssetVendorTypes(trx)

      const workspaceId = MAP_EXISTING_TO_PLATFORM[programId]?.[0] ?? programId

      // Get existing asset types from IoT database
      const existingAssetTypes = await migrationDB
        .selectFrom("asset_type")
        .select([
          "id",
          "name",
          "description",
          "min_temp",
          "max_temp",
          "min_temp_2",
          "max_temp_2",
          "min_temp_3",
          "max_temp_3",
          "is_coldstorage",
          "is_electricity",
          "is_selection",
          "created_by",
          "updated_by",
          "created_at",
          "updated_at",
        ])
        .where("deleted_at", "is", null)
        .orderBy("id")
        .execute()

      const [
        mappedUserGlobalCreatedByAssetType,
        mappedUserGlobalUpdatedByAssetType,
        mappedUserProgramCreatedByAssetType,
        mappedUserProgramUpdatedByAssetType,
      ] = await Promise.all([
        getMapGlobalUserIds(collect(existingAssetTypes, "created_by")),
        getMapGlobalUserIds(collect(existingAssetTypes, "updated_by")),
        getMapUserIds(workspaceId, collect(existingAssetTypes, "created_by")),
        getMapUserIds(workspaceId, collect(existingAssetTypes, "updated_by")),
      ])

      assetTypeCount = existingAssetTypes.length
      console.info(`migrating ${existingAssetTypes.length} asset types`)

      const mapExistingToPlatform: Record<number, number> = {}

      // Create asset type workspace relationship
      for (const existingAssetType of existingAssetTypes) {
        console.log(`migrating asset type ${existingAssetType.id}`)

        const globalId = await insertAssetTypes(
          trx,
          existingAssetType,
          mappedUserGlobalCreatedByAssetType,
          mappedUserGlobalUpdatedByAssetType
        )

        mapExistingToPlatform[existingAssetType.id] = globalId

        await insertAssetTypeWorkspace(
          trx,
          globalId,
          workspaceId,
          existingAssetType,
          mappedUserProgramCreatedByAssetType,
          mappedUserProgramUpdatedByAssetType
        )
        assetTypeWorkspaceCount++
      }

      // Insert mapping data
      await insertTableMapping("asset_types", programId, mapExistingToPlatform)

      // Get existing asset models from IoT database with asset_type_id from asset_type_model_manufacture table
      const existingAssetModels = await migrationDB
        .selectFrom("asset_model")
        .innerJoin(
          "asset_type_model_manufacture",
          "asset_model.id",
          "asset_type_model_manufacture.asset_model_id"
        )
        .select([
          "asset_model.id",
          "asset_model.name",
          "asset_model.capacity",
          "asset_model.created_at",
          "asset_model.updated_at",
          "asset_model.created_by",
          "asset_model.updated_by",
          "asset_model.capacity_gross",
          "asset_model.capacity_nett",
          "asset_model.capacity_gross_2",
          "asset_model.capacity_nett_2",
          "asset_model.capacity_gross_3",
          "asset_model.capacity_nett_3",
          "asset_type_model_manufacture.asset_type_id",
          "asset_type_model_manufacture.manufacture_id",
        ])
        .where("asset_model.deleted_at", "is", null)
        .where("asset_type_model_manufacture.deleted_at", "is", null)
        .orderBy("asset_model.id")
        .execute()

      assetModelCount = existingAssetModels.length
      console.info(`migrating ${existingAssetModels.length} asset models`)

      // Pre-fetch all mapping data for better performance
      const assetTypeIds = existingAssetModels
        .map((model) => model.asset_type_id)
        .filter((id): id is number => id !== null)
      const manufactureIds = existingAssetModels
        .map((model) => model.manufacture_id)
        .filter((id): id is number => id !== null)

      const [
        mappedUserGlobalCreatedByAssetModel,
        mappedUserGlobalUpdatedByAssetModel,
        mappedUserProgramCreatedByAssetModel,
        mappedUserProgramUpdatedByAssetModel,
        assetTypeMapping,
        manufactureMapping,
      ] = await Promise.all([
        getMapGlobalUserIds(collect(existingAssetModels, "created_by")),
        getMapGlobalUserIds(collect(existingAssetModels, "updated_by")),
        getMapUserIds(workspaceId, collect(existingAssetModels, "created_by")),
        getMapUserIds(workspaceId, collect(existingAssetModels, "updated_by")),
        getMapAssetTypeIds(programId, assetTypeIds),
        getMapGlobalManufactureIds(programId, manufactureIds),
      ])

      const mapAssetModelExistingToPlatform: Record<number, number> = {}

      for (const existingAssetModel of existingAssetModels) {
        console.log(`migrating asset model ${existingAssetModel.id}`)

        const globalId = await insertAssetModelsWithMapping(
          trx,
          existingAssetModel,
          assetTypeMapping,
          manufactureMapping,
          mappedUserGlobalCreatedByAssetModel,
          mappedUserGlobalUpdatedByAssetModel
        )

        mapAssetModelExistingToPlatform[existingAssetModel.id] = globalId

        // Create asset model workspace relationship
        await insertAssetModelWorkspace(
          trx,
          globalId,
          workspaceId,
          existingAssetModel,
          mappedUserProgramCreatedByAssetModel,
          mappedUserProgramUpdatedByAssetModel
        )
        assetModelWorkspaceCount++
      }

      // Insert mapping data for asset models
      await insertTableMapping(
        "asset_models",
        programId,
        mapAssetModelExistingToPlatform
      )

      // Get existing asset vendors from IoT database
      const existingAssetVendors = await migrationDB
        .selectFrom("asset_vendors")
        .select([
          "id",
          "name",
          "type",
          "description",
          "created_at",
          "updated_at",
          "created_by",
          "updated_by",
        ])
        .where("deleted_at", "is", null)
        .orderBy("id")
        .execute()

      assetVendorCount = existingAssetVendors.length
      console.info(`migrating ${existingAssetVendors.length} asset vendors`)

      const mapAssetVendorExistingToPlatform: Record<number, number> = {}

      for (const existingAssetVendor of existingAssetVendors) {
        console.log(`migrating asset vendor ${existingAssetVendor.id}`)

        const globalId = await insertAssetVendor(
          trx,
          existingAssetVendor,
          programId
        )

        mapAssetVendorExistingToPlatform[existingAssetVendor.id] = globalId

        // Create asset vendor workspace relationship
        const workspaceId =
          MAP_EXISTING_TO_PLATFORM[programId]?.[0] ?? programId
        await insertAssetVendorWorkspace(
          trx,
          globalId,
          workspaceId,
          existingAssetVendor
        )
        assetVendorWorkspaceCount++
      }

      if (existingAssetVendors.length > 0) {
        // Insert mapping data for asset vendors
        await insertTableMapping("asset_vendors", programId)
      }

      const endTime = new Date()
      const duration = formatDuration(startTime, endTime)

      console.log(
        `\n🎉 Migration assets finished at: ${endTime.toLocaleString()}`
      )
      console.info(`📊 Total duration: ${duration}`)
      console.info(`📈 Summary:`)
      console.info(`   - Asset Types: ${assetTypeCount} records`)
      console.info(
        `   - Asset Type Workspaces: ${assetTypeWorkspaceCount} records`
      )
      console.info(`   - Asset Models: ${assetModelCount} records`)
      console.info(
        `   - Asset Model Workspaces: ${assetModelWorkspaceCount} records`
      )
      console.info(`   - Asset Vendors: ${assetVendorCount} records`)
      console.info(
        `   - Asset Vendor Workspaces: ${assetVendorWorkspaceCount} records`
      )
      console.info("✅ All assets migration completed successfully")
    })
    process.exit(0)
  } catch (error) {
    console.error("❌ Migration failed:", error)
    throw error
  }
}

async function insertAssetTypes(
  trx: Transaction<PlatformDB>,
  existingAssetType: MigrationAssetTypeDTO,
  mappedUserGlobalCreatedByAssetType: Record<number, number>,
  mappedUserGlobalUpdatedByAssetType: Record<number, number>
): Promise<number> {
  // Determine temperature range - prioritize min_temp/max_temp, fallback to min_temp_2/max_temp_2
  let minTemperature = existingAssetType.min_temp
  let maxTemperature = existingAssetType.max_temp

  if (minTemperature === null && existingAssetType.min_temp_2 !== null) {
    minTemperature = existingAssetType.min_temp_2
  }
  if (maxTemperature === null && existingAssetType.max_temp_2 !== null) {
    maxTemperature = existingAssetType.max_temp_2
  }

  // Insert new asset type
  const result = await trx
    .insertInto("asset_types")
    .values({
      name: existingAssetType.name ?? "",
      description: existingAssetType.description,
      min_temperature: minTemperature,
      max_temperature: maxTemperature,
      created_by:
        mappedUserGlobalCreatedByAssetType[
          existingAssetType.created_by ?? -1
        ] ?? null,
      updated_by:
        mappedUserGlobalUpdatedByAssetType[
          existingAssetType.updated_by ?? -1
        ] ?? null,
      created_at: existingAssetType.created_at ?? new Date(),
      updated_at: existingAssetType.updated_at ?? new Date(),
    })
    .executeTakeFirstOrThrow()

  const globalId = Number(result.insertId)
  console.log(
    `Created new asset type: ${existingAssetType.name} with ID: ${globalId}`
  )
  return globalId
}

async function insertAssetTypeWorkspace(
  trx: Transaction<PlatformDB>,
  assetTypeId: number,
  workspaceId: number,
  existingAssetType: MigrationAssetTypeDTO,
  mappedUserProgramCreatedByAssetType: Record<string, number>,
  mappedUserProgramUpdatedByAssetType: Record<string, number>
) {
  // Check if relationship already exists
  const existingRelation = await trx
    .selectFrom("asset_type_workspaces")
    .selectAll()
    .where("asset_type_id", "=", assetTypeId)
    .where("workspace_id", "=", workspaceId)
    .executeTakeFirst()

  if (existingRelation) {
    console.log(
      `Asset type workspace relationship already exists for asset_type_id: ${assetTypeId}, workspace_id: ${workspaceId}`
    )
    return
  }

  await trx
    .insertInto("asset_type_workspaces")
    .values({
      asset_type_id: assetTypeId,
      workspace_id: workspaceId,
      status: 1, // Active status
      created_by:
        mappedUserProgramCreatedByAssetType[
          existingAssetType.created_by ?? -1
        ] ?? null,
      updated_by:
        mappedUserProgramUpdatedByAssetType[
          existingAssetType.updated_by ?? -1
        ] ?? null,
      created_at: existingAssetType.created_at ?? new Date(),
      updated_at: existingAssetType.updated_at ?? new Date(),
    })
    .execute()

  console.log(
    `Created asset type workspace relationship: asset_type_id=${assetTypeId}, workspace_id=${workspaceId}`
  )
}

async function insertAssetModelsWithMapping(
  trx: Transaction<PlatformDB>,
  existingAssetModel: MigrationAssetModelDTO,
  assetTypeMapping: Record<number, number>,
  manufactureMapping: Record<number, number>,
  mappedUserGlobalCreatedByAssetModel: Record<number, number>,
  mappedUserGlobalUpdatedByAssetModel: Record<number, number>
): Promise<number> {
  // Determine capacity - prioritize capacity_nett, fallback to capacity_nett_2, then capacity
  let netCapacity = existingAssetModel.capacity_nett
  let grossCapacity = existingAssetModel.capacity_gross

  if (netCapacity === null && existingAssetModel.capacity_nett_2 !== null) {
    netCapacity = existingAssetModel.capacity_nett_2
  }
  if (grossCapacity === null && existingAssetModel.capacity_gross_2 !== null) {
    grossCapacity = existingAssetModel.capacity_gross_2
  }

  // Fallback to legacy capacity field if both net and gross are null
  if (
    netCapacity === null &&
    grossCapacity === null &&
    existingAssetModel.capacity !== null
  ) {
    netCapacity = existingAssetModel.capacity
  }

  // Map asset_type_id from pre-fetched mapping
  let mappedAssetTypeId = 1 // Default fallback
  if (existingAssetModel.asset_type_id) {
    mappedAssetTypeId = assetTypeMapping[existingAssetModel.asset_type_id] || 1
    if (!assetTypeMapping[existingAssetModel.asset_type_id]) {
      console.warn(
        `Asset type mapping not found for asset_type_id: ${existingAssetModel.asset_type_id}, using default value 1`
      )
    }
  }

  // Map manufacture_id from pre-fetched mapping
  let mappedManufactureId = 1 // Default fallback
  if (existingAssetModel.manufacture_id) {
    mappedManufactureId =
      manufactureMapping[existingAssetModel.manufacture_id] || 1
    if (!manufactureMapping[existingAssetModel.manufacture_id]) {
      console.warn(
        `Manufacture mapping not found for manufacture_id: ${existingAssetModel.manufacture_id}, using default value 1`
      )
    }
  }

  // Insert new asset model
  const result = await trx
    .insertInto("asset_models")
    .values({
      name: existingAssetModel.name ?? "",
      asset_type_id: mappedAssetTypeId,
      manufacture_id: mappedManufactureId,
      net_capacity: netCapacity,
      gross_capacity: grossCapacity,
      created_by:
        mappedUserGlobalCreatedByAssetModel[
          existingAssetModel.created_by ?? -1
        ] ?? null,
      updated_by:
        mappedUserGlobalUpdatedByAssetModel[
          existingAssetModel.updated_by ?? -1
        ] ?? null,
      created_at: existingAssetModel.created_at ?? new Date(),
      updated_at: existingAssetModel.updated_at ?? new Date(),
    })
    .executeTakeFirstOrThrow()

  const globalId = Number(result.insertId)
  console.log(
    `Created new asset model: ${existingAssetModel.name} with ID: ${globalId} (asset_type_id: ${mappedAssetTypeId}, manufacture_id: ${mappedManufactureId})`
  )
  return globalId
}

async function insertAssetModelWorkspace(
  trx: Transaction<PlatformDB>,
  assetModelId: number,
  workspaceId: number,
  existingAssetModel: MigrationAssetModelDTO,
  mappedUserProgramCreatedByAssetModel: Record<number, number>,
  mappedUserProgramUpdatedByAssetModel: Record<number, number>
) {
  // Check if relationship already exists
  const existingRelation = await trx
    .selectFrom("asset_model_workspaces")
    .selectAll()
    .where("asset_model_id", "=", assetModelId)
    .where("workspace_id", "=", workspaceId)
    .executeTakeFirst()

  if (existingRelation) {
    console.log(
      `Asset model workspace relationship already exists for asset_model_id: ${assetModelId}, workspace_id: ${workspaceId}`
    )
    return
  }

  await trx
    .insertInto("asset_model_workspaces")
    .values({
      asset_model_id: assetModelId,
      workspace_id: workspaceId,
      status: 1, // Active status
      created_by:
        mappedUserProgramCreatedByAssetModel[
          existingAssetModel.created_by ?? -1
        ] ?? null,
      updated_by:
        mappedUserProgramUpdatedByAssetModel[
          existingAssetModel.updated_by ?? -1
        ] ?? null,
      created_at: existingAssetModel.created_at ?? new Date(),
      updated_at: existingAssetModel.updated_at ?? new Date(),
    })
    .execute()

  console.log(
    `Created asset model workspace relationship: asset_model_id=${assetModelId}, workspace_id=${workspaceId}`
  )
}

export const migrateAssetModels = async (programId = 1) => {
  const startTime = new Date()
  console.info(
    `Migration asset models started at: ${startTime.toLocaleString()}`
  )
  console.info("migrating asset models...", programId)

  const migrationDB = getMigrationDB(programId)

  let assetModelCount = 0
  let assetModelWorkspaceCount = 0

  try {
    await db.transaction().execute(async (trx) => {
      // Get existing asset models from IoT database with asset_type_id from asset_type_model_manufacture table
      const existingAssetModels = await migrationDB
        .selectFrom("asset_model")
        .leftJoin(
          "asset_type_model_manufacture",
          "asset_model.id",
          "asset_type_model_manufacture.asset_model_id"
        )
        .select([
          "asset_model.id",
          "asset_model.name",
          "asset_model.capacity",
          "asset_model.created_at",
          "asset_model.updated_at",
          "asset_model.created_by",
          "asset_model.updated_by",
          "asset_model.capacity_gross",
          "asset_model.capacity_nett",
          "asset_model.capacity_gross_2",
          "asset_model.capacity_nett_2",
          "asset_model.capacity_gross_3",
          "asset_model.capacity_nett_3",
          "asset_type_model_manufacture.asset_type_id",
          "asset_type_model_manufacture.manufacture_id",
        ])
        .where("asset_model.deleted_at", "is", null)
        .where("asset_type_model_manufacture.deleted_at", "is", null)
        .orderBy("asset_model.id")
        .execute()

      const workspaceId = MAP_EXISTING_TO_PLATFORM[programId]?.[0] ?? programId

      // Pre-fetch all mapping data for better performance
      const assetTypeIds = existingAssetModels
        .map((model) => model.asset_type_id)
        .filter((id): id is number => id !== null)
      const manufactureIds = existingAssetModels
        .map((model) => model.manufacture_id)
        .filter((id): id is number => id !== null)

      const [
        mappedUserGlobalCreatedByAssetModel,
        mappedUserGlobalUpdatedByAssetModel,
        mappedUserProgramCreatedByAssetModel,
        mappedUserProgramUpdatedByAssetModel,
        assetTypeMapping,
        manufactureMapping,
      ] = await Promise.all([
        getMapGlobalUserIds(collect(existingAssetModels, "created_by")),
        getMapGlobalUserIds(collect(existingAssetModels, "updated_by")),
        getMapUserIds(workspaceId, collect(existingAssetModels, "created_by")),
        getMapUserIds(workspaceId, collect(existingAssetModels, "updated_by")),
        getMapAssetTypeIds(programId, assetTypeIds),
        getMapManufactureIds(programId, manufactureIds),
      ])

      assetModelCount = existingAssetModels.length
      console.info(`migrating ${existingAssetModels.length} asset models`)

      const mapAssetModelExistingToPlatform: Record<number, number> = {}

      for (const existingAssetModel of existingAssetModels) {
        console.log(`migrating asset model ${existingAssetModel.id}`)

        const globalId = await insertAssetModelsWithMapping(
          trx,
          existingAssetModel,
          assetTypeMapping,
          manufactureMapping,
          mappedUserGlobalCreatedByAssetModel,
          mappedUserGlobalUpdatedByAssetModel
        )

        mapAssetModelExistingToPlatform[existingAssetModel.id] = globalId

        // Create asset model workspace relationship
        await insertAssetModelWorkspace(
          trx,
          globalId,
          workspaceId,
          existingAssetModel,
          mappedUserProgramCreatedByAssetModel,
          mappedUserProgramUpdatedByAssetModel
        )
        assetModelWorkspaceCount++
      }

      // Insert mapping data for asset models
      await insertTableMapping(
        "asset_models",
        programId,
        mapAssetModelExistingToPlatform
      )

      const endTime = new Date()
      const duration = formatDuration(startTime, endTime)

      console.log(
        `\n🎉 Migration asset models finished at: ${endTime.toLocaleString()}`
      )
      console.info(`📊 Total duration: ${duration}`)
      console.info(`📈 Summary:`)
      console.info(`   - Asset Models: ${assetModelCount} records`)
      console.info(
        `   - Asset Model Workspaces: ${assetModelWorkspaceCount} records`
      )
      console.info("✅ All asset models migration completed successfully")
    })
  } catch (error) {
    console.error("❌ Asset models migration failed:", error)
    throw error
  }
}

async function ensureAssetVendorTypes(trx: Transaction<PlatformDB>) {
  // Check if asset vendor types already exist
  const existingTypes = await trx
    .selectFrom("asset_vendor_types")
    .selectAll()
    .execute()

  if (existingTypes.length === 0) {
    // Insert default asset vendor types
    const assetVendorTypes = [
      { name: "asset_vendor_type.label.continous_temperature_monitoring" },
      { name: "asset_vendor_type.label.refrigerator" },
      { name: "asset_vendor_type.label.vaccine" },
    ]

    for (const vendorType of assetVendorTypes) {
      await trx
        .insertInto("asset_vendor_types")
        .values({
          name: vendorType.name,
          created_at: new Date(),
          updated_at: new Date(),
        })
        .execute()
    }
    console.log("Created default asset vendor types")
  }
}

async function insertAssetVendor(
  trx: Transaction<PlatformDB>,
  existingAssetVendor: MigrationAssetVendorDTO,
  programId: number
): Promise<number> {
  // Map vendor type to asset_vendor_type_id
  let assetVendorTypeId = ASSET_VENDOR_TYPE_MAPPING.default
  if (existingAssetVendor.type) {
    assetVendorTypeId =
      ASSET_VENDOR_TYPE_MAPPING[existingAssetVendor.type.toLowerCase()] ||
      ASSET_VENDOR_TYPE_MAPPING.default
  }

  // Insert new asset vendor
  const result = await trx
    .insertInto("asset_vendors")
    .values({
      name: existingAssetVendor.name ?? "",
      asset_vendor_type_id: assetVendorTypeId,
      description: existingAssetVendor.description,
      created_by: existingAssetVendor.created_by,
      updated_by: existingAssetVendor.updated_by,
      created_at: existingAssetVendor.created_at ?? new Date(),
      updated_at: existingAssetVendor.updated_at ?? new Date(),
    })
    .executeTakeFirstOrThrow()

  const globalId = Number(result.insertId)
  console.log(
    `Created new asset vendor: ${existingAssetVendor.name} with ID: ${globalId} (type_id: ${assetVendorTypeId})`
  )
  return globalId
}

async function insertAssetVendorWorkspace(
  trx: Transaction<PlatformDB>,
  assetVendorId: number,
  workspaceId: number,
  existingAssetVendor: MigrationAssetVendorDTO
) {
  // Check if relationship already exists
  const existingRelation = await trx
    .selectFrom("asset_vendor_workspaces")
    .selectAll()
    .where("asset_vendor_id", "=", assetVendorId)
    .where("workspace_id", "=", workspaceId)
    .executeTakeFirst()

  if (existingRelation) {
    console.log(
      `Asset vendor workspace relationship already exists for asset_vendor_id: ${assetVendorId}, workspace_id: ${workspaceId}`
    )
    return
  }

  await trx
    .insertInto("asset_vendor_workspaces")
    .values({
      asset_vendor_id: assetVendorId,
      workspace_id: workspaceId,
      status: 1, // Active status
      created_by: existingAssetVendor.created_by,
      updated_by: existingAssetVendor.updated_by,
      created_at: existingAssetVendor.created_at ?? new Date(),
      updated_at: existingAssetVendor.updated_at ?? new Date(),
    })
    .execute()

  console.log(
    `Created asset vendor workspace relationship: asset_vendor_id=${assetVendorId}, workspace_id=${workspaceId}`
  )
}

export const migrateAssetVendors = async (programId = 1) => {
  const startTime = new Date()
  console.info(
    `Migration asset vendors started at: ${startTime.toLocaleString()}`
  )
  console.info("migrating asset vendors...", programId)

  const migrationDB = getMigrationDB(programId)

  let assetVendorCount = 0
  let assetVendorWorkspaceCount = 0

  try {
    await db.transaction().execute(async (trx) => {
      // First, ensure asset vendor types exist
      await ensureAssetVendorTypes(trx)

      // Get existing asset vendors from IoT database
      const existingAssetVendors = await migrationDB
        .selectFrom("asset_vendors")
        .select([
          "id",
          "name",
          "type",
          "description",
          "created_at",
          "updated_at",
          "created_by",
          "updated_by",
        ])
        .where("deleted_at", "is", null)
        .orderBy("id")
        .execute()

      assetVendorCount = existingAssetVendors.length
      console.info(`migrating ${existingAssetVendors.length} asset vendors`)

      const mapAssetVendorExistingToPlatform: Record<number, number> = {}

      for (const existingAssetVendor of existingAssetVendors) {
        console.log(`migrating asset vendor ${existingAssetVendor.id}`)

        const globalId = await insertAssetVendor(
          trx,
          existingAssetVendor,
          programId
        )

        mapAssetVendorExistingToPlatform[existingAssetVendor.id] = globalId

        // Create asset vendor workspace relationship
        const workspaceId =
          MAP_EXISTING_TO_PLATFORM[programId]?.[0] ?? programId
        await insertAssetVendorWorkspace(
          trx,
          globalId,
          workspaceId,
          existingAssetVendor
        )
        assetVendorWorkspaceCount++
      }

      // Insert mapping data for asset vendors
      await insertTableMapping(
        "asset_vendors",
        programId,
        mapAssetVendorExistingToPlatform
      )

      const endTime = new Date()
      const duration = formatDuration(startTime, endTime)

      console.log(
        `\n🎉 Migration asset vendors finished at: ${endTime.toLocaleString()}`
      )
      console.info(`📊 Total duration: ${duration}`)
      console.info(`📈 Summary:`)
      console.info(`   - Asset Vendors: ${assetVendorCount} records`)
      console.info(
        `   - Asset Vendor Workspaces: ${assetVendorWorkspaceCount} records`
      )
      console.info("✅ All asset vendors migration completed successfully")
    })
  } catch (error) {
    console.error("❌ Asset vendors migration failed:", error)
    throw error
  }
}
