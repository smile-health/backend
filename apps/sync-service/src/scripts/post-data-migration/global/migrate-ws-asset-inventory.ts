import { Transaction } from "kysely"
import { db } from "../../db.platform.js"
import { resetIncrement } from "../../helper.js"
import { DB } from "../../types.platform.js"

const CHUNK_SIZE = 1000
const now = new Date()

async function mappingGlobalIds(wsAssetInventories, fieldProgramId, tableName) {
  const mappingProgramIds = wsAssetInventories
    .filter(
      (v5) => v5[fieldProgramId] !== null && v5[fieldProgramId] !== undefined
    )
    .map((v5) => v5[fieldProgramId])

  if (mappingProgramIds.length === 0) return null

  const mappingPrograms = await db
    .selectFrom(tableName)
    .select(["id", "global_id"])
    .where("id", "in", mappingProgramIds)
    .execute()

  const existingProgramToGlobal = new Map<number, number>()
  for (const m of mappingPrograms) {
    existingProgramToGlobal.set(m.id, m.global_id)
  }

  return existingProgramToGlobal
}

export async function migrateWsAssetInventories(limit = CHUNK_SIZE) {
  console.time("⏱️ Full migration start at")
  let offset = 0
  let total = 0

  // ========================
  // TRUNCATE FLOW
  // ========================
  const fullWsAssetInventories = await db
    .selectFrom("ws_asset_inventories as wai")
    .select(["wai.id"])
    .orderBy("wai.id")
    .execute()

  //mapping ws_asset_inventories id
  const wsAssetInventoriesIds = fullWsAssetInventories.map((v5) => v5.id)

  //hapus tabel utama dan relasinya terlebih dahulu
  await db
    .deleteFrom("asset_inventory_other_capacities")
    .where("asset_inventory_id", "in", wsAssetInventoriesIds)
    .execute()

  await db
    .deleteFrom("contact_persons")
    .where("source_type", "=", "asset_inventory")
    .where("source_id", "in", wsAssetInventoriesIds)
    .execute()

  await db.deleteFrom("asset_inventories").execute()

  // reset increment
  await resetIncrement(db, "asset_inventory_other_capacities")
  await resetIncrement(db, "contact_persons")
  await resetIncrement(db, "asset_inventories")

  // ========================
  // MAIN MIGRATION LOOP
  // ========================
  while (true) {
    const wsAssetInventories = await db
      .selectFrom("ws_asset_inventories as wai")
      .selectAll()
      .orderBy("wai.id")
      .limit(limit)
      .offset(offset)
      .execute()

    if (wsAssetInventories.length === 0) break

    // proses mapping global ke inventories
    const assetTypeSet = await mappingGlobalIds(
      wsAssetInventories,
      "asset_type_id",
      "ws_asset_types"
    )

    const assetModelSet = await mappingGlobalIds(
      wsAssetInventories,
      "asset_model_id",
      "ws_asset_models"
    )

    const manufactureSet = await mappingGlobalIds(
      wsAssetInventories,
      "manufacture_id",
      "ws_manufactures"
    )

    const entitySet = await mappingGlobalIds(
      wsAssetInventories,
      "entity_id",
      "ws_entities"
    )

    const borrowedFromEntitySet = await mappingGlobalIds(
      wsAssetInventories,
      "borrowed_from_entity_id",
      "ws_entities"
    )

    const budgetSourceSet = await mappingGlobalIds(
      wsAssetInventories,
      "budget_source_id",
      "ws_budget_sources"
    )

    const warrantyVendorSet = await mappingGlobalIds(
      wsAssetInventories,
      "warranty_asset_vendor_id",
      "ws_asset_vendors"
    )

    const maintenanceVendorSet = await mappingGlobalIds(
      wsAssetInventories,
      "maintenance_asset_vendor_id",
      "ws_asset_vendors"
    )

    const calibrationVendorSet = await mappingGlobalIds(
      wsAssetInventories,
      "calibration_asset_vendor_id",
      "ws_asset_vendors"
    )

    const userCreatedSet = await mappingGlobalIds(
      wsAssetInventories,
      "created_by",
      "ws_users"
    )

    const userUpdatedSet = await mappingGlobalIds(
      wsAssetInventories,
      "updated_by",
      "ws_users"
    )

    const userDeletedSet = await mappingGlobalIds(
      wsAssetInventories,
      "deleted_by",
      "ws_users"
    )

    const enrichedWsAssetInventoriesRaw = wsAssetInventories.map(async (m) => ({
      ...m,
      global_asset_type_id:
        m.asset_type_id !== null && assetTypeSet !== null
          ? assetTypeSet.get(m.asset_type_id)
          : null,
      global_asset_model_id:
        m.asset_model_id !== null && assetModelSet !== null
          ? assetModelSet.get(m.asset_model_id)
          : null,
      global_manufacture_id:
        m.manufacture_id !== null && manufactureSet !== null
          ? manufactureSet.get(m.manufacture_id)
          : null,
      global_entity_id:
        m.entity_id !== null && entitySet !== null
          ? entitySet.get(m.entity_id)
          : null,
      global_borrowed_from_entity_id:
        m.borrowed_from_entity_id !== null && borrowedFromEntitySet !== null
          ? borrowedFromEntitySet.get(m.borrowed_from_entity_id)
          : null,
      global_budget_source_id:
        m.budget_source_id !== null && budgetSourceSet !== null
          ? budgetSourceSet.get(m.budget_source_id)
          : null,
      global_warranty_asset_vendor_id:
        m.warranty_asset_vendor_id !== null && warrantyVendorSet !== null
          ? warrantyVendorSet.get(m.warranty_asset_vendor_id)
          : null,
      global_maintenance_asset_vendor_id:
        m.maintenance_asset_vendor_id !== null && maintenanceVendorSet !== null
          ? maintenanceVendorSet.get(m.maintenance_asset_vendor_id)
          : null,
      global_calibration_asset_vendor_id:
        m.calibration_asset_vendor_id !== null && calibrationVendorSet !== null
          ? calibrationVendorSet.get(m.calibration_asset_vendor_id)
          : null,
      global_user_created_id:
        m.created_by !== null && userCreatedSet !== null
          ? userCreatedSet.get(m.created_by)
          : null,
      global_user_updated_id:
        m.updated_by !== null && userUpdatedSet !== null
          ? userUpdatedSet.get(m.updated_by)
          : null,
      global_user_deleted_id:
        m.deleted_by !== null && userDeletedSet !== null
          ? userDeletedSet.get(m.deleted_by)
          : null,
    }))

    const enrichedWsAssetInventories = await Promise.all(
      enrichedWsAssetInventoriesRaw
    )

    await db.transaction().execute(async (trx: Transaction<DB>) => {
      for (const wai of enrichedWsAssetInventories) {
        try {
          const inserted = await trx
            .insertInto("asset_inventories")
            .values({
              id: wai.id,
              asset_type_id: wai.global_asset_type_id,
              other_asset_type_name: wai.other_asset_type_name,
              asset_model_id: wai.global_asset_model_id,
              other_asset_model_name: wai.other_asset_model_name,
              manufacture_id: wai.global_manufacture_id,
              other_asset_manufacture_name: wai.other_manufacture_name,
              entity_id: wai.global_entity_id,
              borrowed_from_entity_id: wai.global_borrowed_from_entity_id,
              other_borrowed_from_entity_name:
                wai.other_borrowed_from_entity_name,
              budget_source_id: wai.global_budget_source_id,
              other_asset_budget_source_name: wai.other_budget_source_name,
              warranty_asset_vendor_id: wai.global_warranty_asset_vendor_id,
              warranty_start_date: wai.warranty_start_date
                ? new Date(wai.warranty_start_date)
                : null,
              warranty_end_date: wai.warranty_end_date
                ? new Date(wai.warranty_end_date)
                : null,
              maintenance_asset_vendor_id:
                wai.global_maintenance_asset_vendor_id,
              maintenance_last_date: wai.maintenance_last_date
                ? new Date(wai.maintenance_last_date)
                : null,
              maintenance_schedule_id: wai.maintenance_schedule_id,
              calibration_asset_vendor_id:
                wai.global_calibration_asset_vendor_id,
              calibration_last_date: wai.calibration_last_date
                ? new Date(wai.calibration_last_date)
                : null,
              calibration_schedule_id: wai.calibration_schedule_id,
              serial_number: wai.serial_number,
              production_year: wai.production_year,
              working_status_id: wai.asset_working_status_id,
              ownership_status: wai.ownership_status,
              budget_year: wai.budget_year,
              electricity_id: wai.asset_electricity_id,
              status: wai.status,
              ownership_qty: wai.ownership_qty,
              created_by: wai.global_user_created_id,
              created_at: wai.created_at ? new Date(wai.created_at) : now,
              updated_by: wai.global_user_updated_id,
              updated_at: wai.updated_at ? new Date(wai.updated_at) : now,
              deleted_by: wai.global_user_deleted_id,
              deleted_at: wai.deleted_at ? new Date(wai.deleted_at) : null,
            })
            .executeTakeFirst()

          if (inserted) {
            total += 1
            if (
              wai.contact_person_user_1_name &&
              wai.contact_person_user_1_number
            ) {
              await trx
                .insertInto("contact_persons")
                .values({
                  name: wai.contact_person_user_1_name,
                  phone: wai.contact_person_user_1_number,
                  source_id: Number(inserted.insertId),
                  source_type: "asset_inventory",
                  created_by: wai.global_user_created_id,
                  created_at: wai.created_at ? new Date(wai.created_at) : now,
                  updated_by: wai.global_user_updated_id,
                  updated_at: wai.updated_at ? new Date(wai.updated_at) : now,
                  deleted_by: wai.global_user_deleted_id,
                  deleted_at: wai.deleted_at ? new Date(wai.deleted_at) : null,
                })
                .executeTakeFirst()
            }

            if (
              wai.contact_person_user_2_name &&
              wai.contact_person_user_2_number
            ) {
              await trx
                .insertInto("contact_persons")
                .values({
                  name: wai.contact_person_user_2_name,
                  phone: wai.contact_person_user_2_number,
                  source_id: Number(inserted.insertId),
                  source_type: "asset_inventory",
                  created_by: wai.global_user_created_id,
                  created_at: wai.created_at ? new Date(wai.created_at) : now,
                  updated_by: wai.global_user_updated_id,
                  updated_at: wai.updated_at ? new Date(wai.updated_at) : now,
                  deleted_by: wai.global_user_deleted_id,
                  deleted_at: wai.deleted_at ? new Date(wai.deleted_at) : null,
                })
                .executeTakeFirst()
            }

            if (
              wai.contact_person_user_3_name &&
              wai.contact_person_user_3_number
            ) {
              await trx
                .insertInto("contact_persons")
                .values({
                  name: wai.contact_person_user_3_name,
                  phone: wai.contact_person_user_3_number,
                  source_id: Number(inserted.insertId),
                  source_type: "asset_inventory",
                  created_by: wai.global_user_created_id,
                  created_at: wai.created_at ? new Date(wai.created_at) : now,
                  updated_by: wai.global_user_updated_id,
                  updated_at: wai.updated_at ? new Date(wai.updated_at) : now,
                  deleted_by: wai.global_user_deleted_id,
                  deleted_at: wai.deleted_at ? new Date(wai.deleted_at) : null,
                })
                .executeTakeFirst()
            }

            const dataOtherInventory = {}

            if (
              !wai.asset_type_id &&
              wai.other_asset_type_name &&
              wai.other_min_temperature !== null
            ) {
              dataOtherInventory["min_temperature"] = wai.other_min_temperature
            }

            if (
              !wai.asset_type_id &&
              wai.other_asset_type_name &&
              wai.other_max_temperature !== null
            ) {
              dataOtherInventory["max_temperature"] = wai.other_max_temperature
            }

            if (
              !wai.asset_model_id &&
              wai.other_asset_model_name &&
              wai.other_net_capacity !== null
            ) {
              dataOtherInventory["net"] = wai.other_net_capacity
            }

            if (
              !wai.asset_model_id &&
              wai.other_asset_model_name &&
              wai.other_gross_capacity !== null
            ) {
              dataOtherInventory["gross"] = wai.other_gross_capacity
            }

            const otherInventoryIsFilled =
              Object.keys(dataOtherInventory).length > 0

            if (otherInventoryIsFilled) {
              dataOtherInventory["asset_inventory_id"] = Number(
                inserted.insertId
              )
              dataOtherInventory["created_at"] = wai.created_at
                ? new Date(wai.created_at)
                : now
              dataOtherInventory["updated_at"] = wai.updated_at
                ? new Date(wai.updated_at)
                : now
              dataOtherInventory["deleted_at"] = wai.deleted_at
                ? new Date(wai.deleted_at)
                : null

              await trx
                .insertInto("asset_inventory_other_capacities")
                .values(dataOtherInventory)
                .executeTakeFirst()
            }
          }
        } catch (err) {
          console.error(
            "❌ Failed inserting asset inventories:",
            wai.serial_number,
            err
          )
        }
      }
    }) // end trx
    offset += limit
  } // end while
  console.timeEnd("⏱️ Full migration end at")
  console.log(`Total migrated rows processed: ${total}`)
}
