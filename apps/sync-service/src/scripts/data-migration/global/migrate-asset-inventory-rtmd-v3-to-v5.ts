import { db as syncDB } from "@/common/infrastructure/database/index.js"
import { Transaction, sql } from "kysely"
import { getMigrationDB as getMigrationDBMain } from "../../db.migration.js"
import { getMigrationDB } from "../../db.migration_iot_new.js"
import { db } from "../../db.platform.js"
import { resetIncrement } from "../../helper.js"
import { DB } from "../../types.platform.js"

const CHUNK_SIZE = 1000
const now = new Date()

const RTMD_TYPE = "Remote Temperature Monitoring"

function makeKey(serial_number, asset_type, asset_model, manufacture) {
  return [
    serial_number ?? null,
    asset_type ?? null,
    asset_model ?? null,
    manufacture ?? null,
  ].join("|")
}

// mengambil data platform global karena asset inventories dan rtmd berada di global
async function mappingGlobalIds(fieldString, tableName, programId) {
  const mappingPlatforms = await syncDB
    .selectFrom(tableName)
    .select(["program_id", `platform_global_id`, `existing_${fieldString}_id`])
    .where("program_id", "=", programId)
    .execute()

  const existingToPlatform = new Map<number, number>()
  for (const m of mappingPlatforms) {
    existingToPlatform.set(
      m[`existing_${fieldString}_id`],
      m[`platform_global_id`]
    )
  }

  return existingToPlatform
}

// mengambil data platform asset karena platform disini dianggap sebagai data global
async function mappingIds(fieldString, tableName, programId) {
  const mappingPlatforms = await syncDB
    .selectFrom(tableName)
    .select([
      "program_id",
      `platform_${fieldString}_id`,
      `existing_${fieldString}_id`,
    ])
    .where("program_id", "=", programId)
    .execute()

  const existingToPlatform = new Map<number, number>()
  for (const m of mappingPlatforms) {
    existingToPlatform.set(
      m[`existing_${fieldString}_id`],
      m[`platform_${fieldString}_id`]
    )
  }

  return existingToPlatform
}

function selectPlatformIds(mappingsGrouped, programId) {
  // group platform_asset_id -> set(program_id)
  const platformIdToPrograms = new Map<number, Set<number>>()
  for (const m of mappingsGrouped) {
    const set =
      platformIdToPrograms.get(m.platform_asset_id) ?? new Set<number>()
    set.add(m.program_id)
    platformIdToPrograms.set(m.platform_asset_id, set)
  }

  // pilih platform IDs yang hanya ada pada programId
  const targetPlatformIds = Array.from(platformIdToPrograms.entries())
    .filter(([_, progSet]) => progSet.size === 1 && progSet.has(programId))
    .map(([id]) => id)

  return targetPlatformIds
}

async function selectionTemperatureId() {
  const assetTypes = await getMigrationDB()
    .selectFrom("asset_type")
    .select(["id"])
    .where("is_coldstorage", "=", 1)
    .where("deleted_at", "is", null)
    .execute()

  const existingAsseTypeIds = assetTypes.map((v3) => v3.id)

  const mappingAssetTypes = await syncDB
    .selectFrom("mapping_asset_types")
    .select("platform_asset_type_id")
    .where("existing_asset_type_id", "in", existingAsseTypeIds)
    .execute()

  const platformAsseTypeIds = mappingAssetTypes.map(
    (v5) => v5.platform_asset_type_id
  )

  const types = await db
    .selectFrom("asset_types_temperatures as att")
    .leftJoin("temperature_thresholds as tt", (join) =>
      join.onRef("att.temperature_threshold_id", "=", "tt.id")
    )
    .leftJoin("asset_models_temperatures_capacities as amtc", (join) =>
      join.onRef("att.id", "=", "amtc.asset_type_temperature_id")
    )
    .select([
      "amtc.id as id",
      "att.asset_type_id",
      "amtc.asset_model_id",
      "tt.min_temperature",
      "tt.max_temperature",
    ])
    .where("att.asset_type_id", "in", platformAsseTypeIds)
    .execute()

  const rangeTemperatureUsedIds = new Map<string, number>()
  for (const m of types) {
    rangeTemperatureUsedIds.set(
      [
        m.asset_type_id ?? null,
        m.asset_model_id ?? null,
        m.min_temperature ?? null,
        m.max_temperature ?? null,
      ].join("|"),
      Number(m.id)
    )
  }

  return rangeTemperatureUsedIds
}

async function contactPerson() {
  const userAssets = await getMigrationDBMain()
    .selectFrom("users")
    .select(["id", "firstname", "mobile_phone", "mobile_phone_2"])
    .execute()

  const contactPersonData = new Map<number, string>()
  for (const m of userAssets) {
    contactPersonData.set(
      m.id,
      [
        m.firstname ?? null,
        m.mobile_phone ?? null,
        m.mobile_phone_2 ?? null,
      ].join("|")
    )
  }

  return contactPersonData
}

async function existingAssetType() {
  const mappingData = await getMigrationDB()
    .selectFrom("asset_type")
    .select(["id", "name"])
    .where("deleted_at", "is", null)
    .execute()

  const existingData = new Map<number, string | null>()
  for (const m of mappingData) {
    existingData.set(m.id, m.name)
  }

  return existingData
}

export async function migrateAssetInventoryRtmdV3ToV5(
  limit = CHUNK_SIZE,
  programId: number = 1,
  truncate: boolean = false
) {
  console.time("⏱️ Full migration start at")
  const migrationDb = getMigrationDB()
  let offset = 0
  let totalOps = 0
  let totalRtmd = 0
  let total = 0
  let totalRelation = 0
  let totalMappingOps = 0
  let totalMappingRtmd = 0
  const opsV5Ids = new Map<string, number>()
  const rawOpsV5Ids = new Map<string, number>()
  const rtmdV5Ids = new Map<string, number>()
  const rawRtmdV5Ids = new Map<string, number>()

  // simpan hasil step truncate
  let targetOpsPlatformIds: number[] = []
  let targetRtmdPlatformIds: number[] = []

  // simpan semua data v3
  const allAssetsV3: any[] = []

  // simpan semua inventory dan rtmd yang sudah diinpit
  const inventoriesInserted = []
  const rtmdsInserted = []

  // ========================
  // TRUNCATE FLOW
  // ========================
  if (truncate) {
    console.log("🧹 Running truncate cleanup before migration...")

    try {
      // ambil semua mapping (program_id + platform_asset_id)
      const mappingsOpsGrouped = await syncDB
        .selectFrom("mapping_assets")
        .select(["program_id", "platform_asset_id"])
        .where("existing_source_type", "=", "asset_inventory")
        .execute()

      const mappingsRtmdGrouped = await syncDB
        .selectFrom("mapping_assets")
        .select(["program_id", "platform_asset_id"])
        .where("existing_source_type", "=", "rtmd")
        .execute()

      if (mappingsOpsGrouped.length > 0 && mappingsRtmdGrouped.length > 0) {
        targetOpsPlatformIds = selectPlatformIds(mappingsOpsGrouped, programId)
        targetRtmdPlatformIds = selectPlatformIds(
          mappingsRtmdGrouped,
          programId
        )
        if (
          targetOpsPlatformIds.length > 0 &&
          targetRtmdPlatformIds.length > 0
        ) {
          await db
            .deleteFrom("asset_inventory_rtmds")
            .where("asset_inventory_id", "in", targetOpsPlatformIds)
            .where("asset_rtmd_id", "in", targetRtmdPlatformIds)
            .execute()

          await resetIncrement(db, "asset_inventory_rtmds")
        }
      }

      if (mappingsOpsGrouped.length > 0) {
        console.log(
          `🧹 Found ${targetOpsPlatformIds.length} asset inventory platform IDs unique to programId=${programId}`
        )

        if (targetOpsPlatformIds.length > 0) {
          await db
            .deleteFrom("contact_persons")
            .where("source_type", "=", "asset_inventory")
            .where("source_id", "in", targetOpsPlatformIds)
            .execute()

          await db
            .deleteFrom("asset_inventory_other_capacities")
            .where("asset_inventory_id", "in", targetOpsPlatformIds)
            .execute()

          await db
            .deleteFrom("asset_inventories")
            .where("id", "in", targetOpsPlatformIds)
            .execute()

          await resetIncrement(db, "contact_persons")
          await resetIncrement(db, "asset_inventory_other_capacities")
          await resetIncrement(db, "asset_inventories")
        }
      }

      if (mappingsRtmdGrouped.length > 0) {
        console.log(
          `🧹 Found ${targetRtmdPlatformIds.length} asset rtmd platform IDs unique to programId=${programId}`
        )

        if (targetRtmdPlatformIds.length > 0) {
          await db
            .deleteFrom("contact_persons")
            .where("source_type", "=", "rtmd")
            .where("source_id", "in", targetRtmdPlatformIds)
            .execute()

          await db
            .deleteFrom("asset_rtmds")
            .where("id", "in", targetRtmdPlatformIds)
            .execute()

          await resetIncrement(db, "contact_persons")
          await resetIncrement(db, "asset_rtmds")
        }
      }
      console.log("🧹 Truncate cleanup done, continue migration...")
    } catch (err) {
      console.error("❌ Error during truncate cleanup:", err)
    }
  }

  // ========================
  // PRE MAIN MIGRATION LOOP
  // ========================

  // proses mapping platform ke asset v3
  const opsAssetTypeSet = await mappingIds(
    "asset_type",
    "mapping_asset_types",
    programId
  )

  const opsAssetModelSet = await mappingIds(
    "asset_model",
    "mapping_asset_models",
    programId
  )

  const opsManufactureSet = await mappingGlobalIds(
    "manufacture",
    "mapping_manufactures",
    programId
  )

  const opsEntitySet = await mappingGlobalIds(
    "entity",
    "mapping_entities",
    programId
  )

  const opsBorrowedFromEntitySet = await mappingGlobalIds(
    "entity",
    "mapping_entities",
    programId
  )

  const opsBudgetSourceSet = await mappingGlobalIds(
    "budget_source",
    "mapping_budget_sources",
    programId
  )

  const opsAssetVendorSet = await mappingIds(
    "asset_vendor",
    "mapping_asset_vendors",
    programId
  )

  const opsUserCreatedSet = await mappingGlobalIds(
    "user",
    "mapping_users",
    programId
  )

  const opsUserUpdatedSet = await mappingGlobalIds(
    "user",
    "mapping_users",
    programId
  )

  const opsSelectionTemperatureSet = await selectionTemperatureId()

  const contactPersonData = await contactPerson()

  const v3AssetType = await existingAssetType()

  const existingOpsV5 = await db
    .selectFrom("asset_inventories")
    .select([
      "id",
      "serial_number",
      "asset_type_id",
      "other_asset_type_name",
      "asset_model_id",
      "other_asset_model_name",
      "manufacture_id",
      "other_asset_manufacture_name",
    ])
    .orderBy("id")
    .execute()

  const existingRtmdV5 = await db
    .selectFrom("asset_rtmds")
    .select([
      "id",
      "serial_number",
      "asset_type_id",
      "asset_model_id",
      "manufacture_id",
    ])
    .orderBy("id")
    .execute()

  // ========================
  // MAIN MIGRATION LOOP
  // ========================
  while (true) {
    const assetsV3 = await migrationDb
      .selectFrom("assets as ops")
      .select([
        "ops.id",
        "ops.parent_id",
        "ops.type_id as ops_asset_type_id",
        "ops.other_type_asset as other_asset_type_name",
        "ops.other_min_temp as other_min_temperature",
        "ops.other_max_temp as other_max_temperature",
        "ops.model_id as ops_asset_model_id",
        "ops.other_model_asset as other_asset_model_name",
        "ops.other_capacity_nett as other_net_capacity",
        "ops.other_capacity_gross as other_gross_capacity",
        "ops.manufacture_id as ops_manufacture_id",
        "ops.other_manufacture as other_asset_manufacture_name",
        "ops.entity_id as ops_entity_id",
        "ops.borrowed_from as ops_borrowed_from_entity_id",
        "ops.budget_src as ops_budget_source_id",
        "ops.other_budget_src as other_asset_budget_source_name",
        "ops.asset_vendor_id as ops_warranty_asset_vendor_id",
        "ops.warranty_start_date as warranty_start_date",
        "ops.warranty_end_date as warranty_end_date",
        "ops.asset_vendor_id as ops_maintenance_asset_vendor_id",
        "ops.maintenance_schedule_id as maintenance_schedule_id",
        "ops.last_maintenance_date as maintenance_last_date",
        "ops.asset_vendor_id as ops_calibration_asset_vendor_id",
        "ops.calibration_schedule_id as calibration_schedule_id",
        "ops.last_calibration_date as calibration_last_date",
        "ops.serial_number as serial_number",
        "ops.prod_year as production_year",
        "ops.working_status_id as working_status_id",
        "ops.logger_status_id as asset_rtmd_status_id",
        "ops.ownership_status as ownership_status",
        "ops.ownership_qty as ownership_qty",
        "ops.budget_year as budget_year",
        "ops.electricity_available_id as electricity_id",
        "ops.status as status",
        "ops.min_temp as min_temp_used",
        "ops.max_temp as max_temp_used",
        "ops.asset_vendor_id as ops_asset_vendor_id",
        "ops.asset_communication_provider_id as ops_asset_communication_provider_id",
        "ops.maintainer_id as maintainer_id",
        "ops.created_by",
        "ops.updated_by",
        "ops.created_at",
        "ops.updated_at",
        "ops.deleted_at",
      ])
      .orderBy("ops.id")
      .limit(limit)
      .offset(offset)
      .execute()

    total += limit

    if (assetsV3.length === 0) break

    const enrichedAssets = assetsV3.map(async (m) => ({
      ...m,
      asset_type_id:
        m.ops_asset_type_id && opsAssetTypeSet
          ? (opsAssetTypeSet.get(m.ops_asset_type_id) ?? null)
          : null,
      asset_model_id:
        m.ops_asset_model_id && opsAssetModelSet
          ? (opsAssetModelSet.get(m.ops_asset_model_id) ?? null)
          : null,
      manufacture_id:
        m.ops_manufacture_id && opsManufactureSet
          ? (opsManufactureSet.get(m.ops_manufacture_id) ?? null)
          : null,
      entity_id:
        m.ops_entity_id && opsEntitySet
          ? (opsEntitySet.get(m.ops_entity_id) ?? null)
          : null,
      borrowed_from_entity_id:
        m.ops_borrowed_from_entity_id && opsBorrowedFromEntitySet
          ? (opsBorrowedFromEntitySet.get(m.ops_borrowed_from_entity_id) ??
            null)
          : null,
      budget_source_id:
        m.ops_budget_source_id && opsBudgetSourceSet
          ? (opsBudgetSourceSet.get(m.ops_budget_source_id) ?? null)
          : null,
      warranty_asset_vendor_id:
        m.ops_warranty_asset_vendor_id && opsAssetVendorSet
          ? (opsAssetVendorSet.get(m.ops_warranty_asset_vendor_id) ?? null)
          : null,
      maintenance_asset_vendor_id:
        m.ops_maintenance_asset_vendor_id && opsAssetVendorSet
          ? (opsAssetVendorSet.get(m.ops_maintenance_asset_vendor_id) ?? null)
          : null,
      calibration_asset_vendor_id:
        m.ops_calibration_asset_vendor_id && opsAssetVendorSet
          ? (opsAssetVendorSet.get(m.ops_calibration_asset_vendor_id) ?? null)
          : null,
      asset_vendor_id:
        m.ops_asset_vendor_id && opsAssetVendorSet
          ? (opsAssetVendorSet.get(m.ops_asset_vendor_id) ?? null)
          : null,
      asset_communication_provider_id:
        m.ops_asset_communication_provider_id && opsAssetVendorSet
          ? (opsAssetVendorSet.get(m.ops_asset_communication_provider_id) ??
            null)
          : null,
      asset_model_temperature_capacity_id:
        m.ops_asset_type_id &&
        opsAssetTypeSet &&
        m.ops_asset_model_id &&
        opsAssetModelSet &&
        m.min_temp_used &&
        m.max_temp_used
          ? opsSelectionTemperatureSet.get(
              [
                opsAssetTypeSet.get(m.ops_asset_type_id) ?? null,
                opsAssetModelSet.get(m.ops_asset_model_id) ?? null,
                m.min_temp_used ?? null,
                m.max_temp_used ?? null,
              ].join("|")
            )
          : null,
      asset_type_name:
        m.ops_asset_type_id && opsAssetTypeSet
          ? (v3AssetType.get(m.ops_asset_type_id)?.trim() ?? null)
          : null,
      user_created_id:
        m.created_by && opsUserCreatedSet
          ? (opsUserCreatedSet.get(m.created_by) ?? null)
          : null,
      user_updated_id:
        m.updated_by && opsUserUpdatedSet
          ? (opsUserUpdatedSet.get(m.updated_by) ?? null)
          : null,
    }))

    const enrichedAssetsResolved = await Promise.all(enrichedAssets)

    allAssetsV3.push(...enrichedAssetsResolved)

    await db.transaction().execute(async (trx: Transaction<DB>) => {
      if (opsV5Ids.size === 0) {
        for (const e of existingOpsV5) {
          const assetType = e.asset_type_id ?? e.other_asset_type_name
          const assetModel = e.asset_model_id ?? e.other_asset_model_name
          const manufacture = e.manufacture_id ?? e.other_asset_manufacture_name

          opsV5Ids.set(
            makeKey(e.serial_number, assetType, assetModel, manufacture),
            e.id
          )
        }
      }

      if (rtmdV5Ids.size === 0) {
        for (const e of existingRtmdV5) {
          rtmdV5Ids.set(
            makeKey(
              e.serial_number,
              e.asset_type_id,
              e.asset_model_id,
              e.manufacture_id
            ),
            e.id
          )
        }
      }

      const inventories = enrichedAssetsResolved.filter(
        (e) => e.asset_type_name !== RTMD_TYPE && e.deleted_at === null
      )
      const rtmds = enrichedAssetsResolved.filter(
        (e) => e.asset_type_name === RTMD_TYPE && e.deleted_at === null
      )

      const bulkInventories: any[] = []
      const opsSerialNumberInserted: any[] = []
      const opsSetKeyInserted = new Map<string, number>()

      const bulkRtmds: any[] = []
      const rtmdSerialNumberInserted: any[] = []
      const rtmdSetKeyInserted = new Map<string, number>()

      const contactPersonsOps: any[] = []
      const otherInventoriesOps: any[] = []
      const contactPersonsRtmd: any[] = []

      if (inventories.length > 0) {
        for (const m of inventories) {
          const assetType = m.asset_type_id ?? m.other_asset_type_name
          const assetModel = m.asset_model_id ?? m.other_asset_model_name
          const manufacture = m.manufacture_id ?? m.other_asset_manufacture_name

          if (m.serial_number && assetType && assetModel && manufacture) {
            const opsKey = makeKey(
              m.serial_number,
              assetType,
              assetModel,
              manufacture
            )

            if (!opsV5Ids.get(opsKey) && !rawOpsV5Ids.get(opsKey)) {
              opsSerialNumberInserted.push(opsKey)
              rawOpsV5Ids.set(opsKey, m.id)
              bulkInventories.push({
                asset_type_id: m.asset_type_id,
                other_asset_type_name: m.other_asset_type_name,
                asset_model_id: m.asset_model_id,
                other_asset_model_name: m.other_asset_model_name,
                manufacture_id: m.manufacture_id,
                other_asset_manufacture_name: m.other_asset_manufacture_name,
                entity_id: m.entity_id,
                borrowed_from_entity_id: m.borrowed_from_entity_id,
                budget_source_id: m.budget_source_id,
                other_asset_budget_source_name:
                  m.other_asset_budget_source_name,
                warranty_asset_vendor_id: m.warranty_asset_vendor_id,
                warranty_start_date: m.warranty_start_date
                  ? new Date(m.warranty_start_date)
                  : null,
                warranty_end_date: m.warranty_end_date
                  ? new Date(m.warranty_end_date)
                  : null,
                maintenance_asset_vendor_id: m.maintenance_asset_vendor_id,
                maintenance_last_date: m.maintenance_last_date
                  ? new Date(m.maintenance_last_date)
                  : null,
                maintenance_schedule_id: m.maintenance_schedule_id,
                calibration_asset_vendor_id: m.calibration_asset_vendor_id,
                calibration_last_date: m.calibration_last_date
                  ? new Date(m.calibration_last_date)
                  : null,
                calibration_schedule_id: m.calibration_schedule_id,
                asset_model_temperature_capacity_id:
                  m.asset_model_temperature_capacity_id,
                serial_number: m.serial_number,
                production_year: m.production_year
                  ? Number(m.production_year)
                  : null,
                working_status_id: m.working_status_id,
                ownership_status: m.ownership_status,
                budget_year: m.budget_year,
                electricity_id: m.electricity_id,
                status: m.status,
                ownership_qty: m.ownership_qty,
                created_by: m.user_created_id,
                created_at: m.created_at ? new Date(m.created_at) : now,
                updated_by: m.user_updated_id,
                updated_at: m.updated_at ? new Date(m.updated_at) : now,
                deleted_at: m.deleted_at ? new Date(m.deleted_at) : null,
              })
            }
          }
        }

        if (bulkInventories.length > 0) {
          await trx
            .insertInto("asset_inventories")
            .values(bulkInventories)
            .execute()
        }

        if (opsSerialNumberInserted.length > 0) {
          const concatKey = sql<string>`
            TRIM(CONCAT_WS('|',
              COALESCE(CAST(${sql.ref("asset_inventories.serial_number")} AS CHAR), ''),
              COALESCE(CAST(${sql.ref("asset_inventories.asset_type_id")} AS CHAR), CAST(${sql.ref("asset_inventories.other_asset_type_name")} AS CHAR), ''),
              COALESCE(CAST(${sql.ref("asset_inventories.asset_model_id")} AS CHAR), CAST(${sql.ref("asset_inventories.other_asset_model_name")} AS CHAR), ''),
              COALESCE(CAST(${sql.ref("asset_inventories.manufacture_id")} AS CHAR), CAST(${sql.ref("asset_inventories.other_asset_manufacture_name")} AS CHAR), '')
            ))
          `

          const newOpsInserted = await trx
            .selectFrom("asset_inventories")
            .select([
              "id",
              "serial_number",
              "asset_type_id",
              "asset_model_id",
              "manufacture_id",
              "other_asset_type_name",
              "other_asset_model_name",
              "other_asset_manufacture_name",
            ])
            // .where("serial_number", "in", opsSerialNumberInserted)
            .where(concatKey, "in", opsSerialNumberInserted)
            .execute()

          if (newOpsInserted.length > 0) {
            for (const m of newOpsInserted) {
              const assetType = m.asset_type_id ?? m.other_asset_type_name
              const assetModel = m.asset_model_id ?? m.other_asset_model_name
              const manufacture =
                m.manufacture_id ?? m.other_asset_manufacture_name

              if (m.serial_number && assetType && assetModel && manufacture) {
                const opsKey = makeKey(
                  m.serial_number,
                  assetType,
                  assetModel,
                  manufacture
                )

                opsSetKeyInserted.set(opsKey, m.id)
              }
            }
          }
        }

        if (opsSerialNumberInserted.length > 0) {
          for (const m of inventories) {
            const assetType = m.asset_type_id ?? m.other_asset_type_name
            const assetModel = m.asset_model_id ?? m.other_asset_model_name
            const manufacture =
              m.manufacture_id ?? m.other_asset_manufacture_name

            if (m.serial_number && assetType && assetModel && manufacture) {
              const opsKey = makeKey(
                m.serial_number,
                assetType,
                assetModel,
                manufacture
              )

              if (rawOpsV5Ids.get(opsKey)) {
                const id = opsSetKeyInserted.get(opsKey)
                if (id) {
                  totalOps += 1
                  const cp = m.maintainer_id
                    ? contactPersonData.get(m.maintainer_id)
                    : null

                  if (cp) {
                    const cpSplit = cp.split("|")

                    contactPersonsOps.push({
                      name: cpSplit[0] ? cpSplit[0] : null,
                      phone: cpSplit[1]
                        ? cpSplit[1]
                        : cpSplit[2]
                          ? cpSplit[2]
                          : null,
                      source_id: id ? Number(id) : null,
                      source_type: "asset_inventory",
                      created_by: m.user_created_id,
                      created_at: m.created_at ? new Date(m.created_at) : now,
                      updated_by: m.user_updated_id,
                      updated_at: m.updated_at ? new Date(m.updated_at) : now,
                      deleted_at: m.deleted_at ? new Date(m.deleted_at) : null,
                    })
                  }

                  const dataOtherInventory = {}

                  if (
                    !m.asset_type_id &&
                    m.other_asset_type_name &&
                    m.other_min_temperature !== null
                  ) {
                    dataOtherInventory["min_temperature"] =
                      m.other_min_temperature
                  }

                  if (
                    !m.asset_type_id &&
                    m.other_asset_type_name &&
                    m.other_max_temperature !== null
                  ) {
                    dataOtherInventory["max_temperature"] =
                      m.other_max_temperature
                  }

                  if (
                    !m.asset_model_id &&
                    m.other_asset_model_name &&
                    m.other_net_capacity !== null
                  ) {
                    dataOtherInventory["net"] = m.other_net_capacity
                  }

                  if (
                    !m.asset_model_id &&
                    m.other_asset_model_name &&
                    m.other_gross_capacity !== null
                  ) {
                    dataOtherInventory["gross"] = m.other_gross_capacity
                  }

                  const otherInventoryIsFilled =
                    Object.keys(dataOtherInventory).length > 0

                  if (otherInventoryIsFilled) {
                    dataOtherInventory["asset_inventory_id"] = Number(id)
                    dataOtherInventory["created_at"] = m.created_at
                      ? new Date(m.created_at)
                      : now
                    dataOtherInventory["updated_at"] = m.updated_at
                      ? new Date(m.updated_at)
                      : now
                    dataOtherInventory["deleted_at"] = m.deleted_at
                      ? new Date(m.deleted_at)
                      : null

                    otherInventoriesOps.push(dataOtherInventory)
                  }

                  inventoriesInserted.push({
                    old_id: m.id,
                    new_id: Number(id),
                  })

                  opsV5Ids.set(opsKey, id)
                }
              }
            }
          }
        }

        if (contactPersonsOps.length > 0) {
          await trx
            .insertInto("contact_persons")
            .values(contactPersonsOps)
            .execute()
        }

        if (otherInventoriesOps.length > 0) {
          await trx
            .insertInto("asset_inventory_other_capacities")
            .values(otherInventoriesOps)
            .execute()
        }
      }

      if (rtmds.length > 0) {
        for (const m of rtmds) {
          if (
            m.serial_number &&
            m.asset_type_id &&
            m.asset_model_id &&
            m.manufacture_id
          ) {
            const rtmdKey = makeKey(
              m.serial_number,
              m.asset_type_id,
              m.asset_model_id,
              m.manufacture_id
            )
            if (!rtmdV5Ids.get(rtmdKey) && !rawRtmdV5Ids.get(rtmdKey)) {
              rtmdSerialNumberInserted.push(rtmdKey)
              rawRtmdV5Ids.set(rtmdKey, m.id)
              bulkRtmds.push({
                asset_type_id: m.asset_type_id,
                asset_model_id: m.asset_model_id,
                manufacture_id: m.manufacture_id,
                entity_id: m.entity_id,
                budget_source_id: m.budget_source_id,
                serial_number: m.serial_number,
                production_year: m.production_year
                  ? Number(m.production_year)
                  : null,
                budget_year: m.budget_year,
                status: m.status,
                asset_vendor_id: m.asset_vendor_id,
                asset_communication_provider_id:
                  m.asset_communication_provider_id,
                asset_rtmd_status_id: m.asset_rtmd_status_id,
                created_by: m.user_created_id,
                created_at: m.created_at ? new Date(m.created_at) : now,
                updated_by: m.user_updated_id,
                updated_at: m.updated_at ? new Date(m.updated_at) : now,
                deleted_at: m.deleted_at ? new Date(m.deleted_at) : null,
              })
            }
          }
        }

        if (bulkRtmds.length > 0) {
          await trx.insertInto("asset_rtmds").values(bulkRtmds).execute()
        }

        if (rtmdSerialNumberInserted.length > 0) {
          const concatKey = sql<string>`
            TRIM(CONCAT_WS('|',
              COALESCE(CAST(${sql.ref("asset_rtmds.serial_number")} AS CHAR), ''),
              COALESCE(CAST(${sql.ref("asset_rtmds.asset_type_id")} AS CHAR), ''),
              COALESCE(CAST(${sql.ref("asset_rtmds.asset_model_id")} AS CHAR), ''),
              COALESCE(CAST(${sql.ref("asset_rtmds.manufacture_id")} AS CHAR), '')
            ))
          `

          const newRtmdInserted = await trx
            .selectFrom("asset_rtmds")
            .select([
              "id",
              "serial_number",
              "asset_type_id",
              "asset_model_id",
              "manufacture_id",
            ])
            .where(concatKey, "in", rtmdSerialNumberInserted)
            .execute()

          if (newRtmdInserted.length > 0) {
            for (const m of newRtmdInserted) {
              if (
                m.serial_number &&
                m.asset_type_id &&
                m.asset_model_id &&
                m.manufacture_id
              ) {
                const rtmdKey = makeKey(
                  m.serial_number,
                  m.asset_type_id,
                  m.asset_model_id,
                  m.manufacture_id
                )
                rtmdSetKeyInserted.set(rtmdKey, m.id)
              }
            }
          }
        }

        if (rtmdSerialNumberInserted.length > 0) {
          for (const m of rtmds) {
            if (
              m.serial_number &&
              m.asset_type_id &&
              m.asset_model_id &&
              m.manufacture_id
            ) {
              const rtmdKey = makeKey(
                m.serial_number,
                m.asset_type_id,
                m.asset_model_id,
                m.manufacture_id
              )

              if (rawRtmdV5Ids.get(rtmdKey)) {
                const id = rtmdSetKeyInserted.get(rtmdKey)
                if (id) {
                  totalRtmd += 1
                  const cp = m.maintainer_id
                    ? contactPersonData.get(m.maintainer_id)
                    : null

                  if (cp) {
                    const cpSplit = cp.split("|")

                    contactPersonsRtmd.push({
                      name: cpSplit[0] ? cpSplit[0] : null,
                      phone: cpSplit[1]
                        ? cpSplit[1]
                        : cpSplit[2]
                          ? cpSplit[2]
                          : null,
                      source_id: id ? Number(id) : null,
                      source_type: "rtmd",
                      created_by: m.user_created_id,
                      created_at: m.created_at ? new Date(m.created_at) : now,
                      updated_by: m.user_updated_id,
                      updated_at: m.updated_at ? new Date(m.updated_at) : now,
                      deleted_at: m.deleted_at ? new Date(m.deleted_at) : null,
                    })
                  }

                  rtmdsInserted.push({
                    old_id: m.id,
                    new_id: Number(id),
                    parent_id: m.parent_id,
                  })

                  rtmdV5Ids.set(rtmdKey, id)
                }
              }
            }
          }
        }

        if (contactPersonsRtmd.length > 0) {
          await trx
            .insertInto("contact_persons")
            .values(contactPersonsRtmd)
            .execute()
        }
      }
    }) // end trx
    offset += limit
  } // end while

  // =================================
  // PART CREATE RELATION OPS AND RTMD
  // =================================
  const inventoriesRtmdsRelations = rtmdsInserted.flatMap((b) => {
    const relations = inventoriesInserted.find((a) => a.old_id === b.parent_id)
    return relations
      ? [
          {
            asset_inventory_id: relations.new_id,
            asset_rtmd_id: b.new_id,
            sensor_qty: 1,
            created_at: now,
            updated_at: now,
          },
        ]
      : []
  })

  if (inventoriesRtmdsRelations.length > 0) {
    for (const relation of inventoriesRtmdsRelations) {
      totalRelation += 1
    }

    await db
      .insertInto("asset_inventory_rtmds")
      .values(inventoriesRtmdsRelations)
      .execute()
  }

  // ========================
  // FINAL TRUNCATE STEP (hapus mapping)
  // ========================
  if (truncate) {
    if (targetOpsPlatformIds.length > 0) {
      console.log(
        `🧹 Final truncate step: deleting mapping for ${targetOpsPlatformIds} platform IDs`
      )
      await syncDB
        .deleteFrom("mapping_assets")
        .where("platform_asset_id", "in", targetOpsPlatformIds)
        .where("program_id", "=", programId)
        .where("existing_source_type", "=", "asset_inventory")
        .execute()
    }

    if (targetRtmdPlatformIds.length > 0) {
      console.log(
        `🧹 Final truncate step: deleting mapping for ${targetRtmdPlatformIds} platform IDs`
      )
      await syncDB
        .deleteFrom("mapping_assets")
        .where("platform_asset_id", "in", targetRtmdPlatformIds)
        .where("program_id", "=", programId)
        .where("existing_source_type", "=", "rtmd")
        .execute()
    }

    await resetIncrement(syncDB, "mapping_assets")
  }

  // ========================
  // FINAL MAPPING SINKRONISASI
  // ========================
  const mappingInventories: any[] = []
  const mappingRtmds: any[] = []

  // `platform_asset_id` dianggap sebagai data global karena berada di global
  const mappingAssets = await syncDB
    .selectFrom("mapping_assets")
    .select(["program_id", "platform_asset_id", "existing_asset_id"])
    .where("program_id", "=", programId)
    .execute()

  const mappingAssetsSet = new Map<number, number>()
  if (mappingAssets.length > 0) {
    for (const m of mappingAssets) {
      mappingAssetsSet.set(m.existing_asset_id, m.platform_asset_id)
    }
  }

  // bagian mapping asset ops
  for (const v3 of allAssetsV3) {
    const assetType = v3.asset_type_id ?? v3.other_asset_type_name
    const assetModel = v3.asset_model_id ?? v3.other_asset_model_name
    const manufacture = v3.manufacture_id ?? v3.other_manufacture_name

    if (v3.serial_number && assetType && assetModel && manufacture) {
      const opsKey = makeKey(
        v3.serial_number,
        assetType,
        assetModel,
        manufacture
      )
      const opsNewV5Id = opsV5Ids.get(opsKey)
      if (!opsNewV5Id) continue
      const opsNewMappingV5Id =
        mappingAssetsSet.size > 0 ? mappingAssetsSet.get(v3.id) : null
      if (opsNewMappingV5Id) continue
      totalMappingOps += 1

      mappingInventories.push({
        program_id: programId,
        platform_asset_id: opsNewMappingV5Id ? opsNewMappingV5Id : opsNewV5Id,
        existing_asset_id: v3.id,
        existing_source_type: "asset_inventory",
        created_at: now,
        updated_at: now,
      })
    }
  }

  // bagian mapping asset rtmd
  for (const v3 of allAssetsV3) {
    if (
      v3.serial_number &&
      v3.asset_type_id &&
      v3.asset_model_id &&
      v3.manufacture_id
    ) {
      const rtmdKey = makeKey(
        v3.serial_number,
        v3.asset_type_id,
        v3.asset_model_id,
        v3.manufacture_id
      )
      const rtmdNewV5Id = rtmdV5Ids.get(rtmdKey)
      if (!rtmdNewV5Id) continue
      const rtmdNewMappingV5Id =
        mappingAssetsSet.size > 0 ? mappingAssetsSet.get(v3.id) : null
      if (rtmdNewMappingV5Id) continue
      totalMappingRtmd += 1

      mappingRtmds.push({
        program_id: programId,
        platform_asset_id: rtmdNewMappingV5Id
          ? rtmdNewMappingV5Id
          : rtmdNewV5Id,
        existing_asset_id: v3.id,
        existing_source_type: "rtmd",
        created_at: now,
        updated_at: now,
      })
    }
  }

  const mappingCombined = [...mappingInventories, ...mappingRtmds]

  if (mappingCombined.length > 0) {
    await syncDB.insertInto("mapping_assets").values(mappingCombined).execute()
  }

  console.timeEnd("⏱️ Full migration end at")
  console.log(`total query all from v3: ${total}`)
  console.log(`Total inventories migrated rows processed: ${totalOps}`)
  console.log(`Total rtmds migrated rows processed: ${totalRtmd}`)
  console.log(`Total relation migrated rows processed: ${totalRelation}`)
  console.log(`Total mapping ops migrated rows processed: ${totalMappingOps}`)
  console.log(`Total mapping rtmd migrated rows processed: ${totalMappingRtmd}`)
}
