import { db as syncDB } from "@/common/infrastructure/database/index.js"
import { Transaction } from "kysely"
import { getMigrationDB } from "../../db.migration_iot_new.js"
import { db } from "../../db.platform.js"
import { resetIncrement } from "../../helper.js"
import { DB } from "../../types.platform.js"

const CHUNK_SIZE = 1000
const now = new Date()

function makeKey(name, asset_type_id, manufacture_id) {
  return [name ?? null, asset_type_id ?? null, manufacture_id ?? null].join("|")
}

// mengambil data platform global karena asset model sebagai data master
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

export async function migrateAssetModelV3ToV5(
  limit = CHUNK_SIZE,
  programId: number = 1,
  truncate: boolean = false
) {
  console.time("⏱️ Full migration start at")
  const migrationDb = getMigrationDB()
  let offset = 0
  let total = 0
  const modelV5Ids = new Map<string, number>()

  // simpan hasil step truncate 2b
  let targetPlatformIds: number[] = []

  // simpan semua data v3
  const allModelsV3: any[] = []

  // ========================
  // TRUNCATE FLOW
  // ========================
  if (truncate) {
    console.log("🧹 Running truncate cleanup before migration...")

    try {
      // 2a. ambil semua mapping (program_id + platform_asset_model_id)
      const mappingsGrouped = await syncDB
        .selectFrom("mapping_asset_models")
        .select(["program_id", "platform_asset_model_id"])
        .execute()

      if (mappingsGrouped.length > 0) {
        // group platform_volume_material_id -> set(program_id)
        const platformIdToPrograms = new Map<number, Set<number>>()
        for (const m of mappingsGrouped) {
          const set =
            platformIdToPrograms.get(m.platform_asset_model_id) ??
            new Set<number>()
          set.add(m.program_id)
          platformIdToPrograms.set(m.platform_asset_model_id, set)
        }

        // 2b. pilih platform IDs yang hanya ada pada programId
        targetPlatformIds = Array.from(platformIdToPrograms.entries())
          .filter(
            ([_, progSet]) => progSet.size === 1 && progSet.has(programId)
          )
          .map(([id]) => id)

        console.log(
          `🧹 Found ${targetPlatformIds.length} platform IDs unique to programId=${programId}`
        )

        if (targetPlatformIds.length > 0) {
          // 3. delete master table: asset models relations
          await db
            .deleteFrom("asset_models_temperatures_capacities")
            .where("asset_model_id", "in", targetPlatformIds)
            .execute()

          await db
            .deleteFrom("asset_models_non_temperatures_capacities")
            .where("asset_model_id", "in", targetPlatformIds)
            .execute()

          await db
            .deleteFrom("asset_models")
            .where("id", "in", targetPlatformIds)
            .execute()

          // 4. reset autoincrement untuk tabel yang dihapus
          await resetIncrement(db, "asset_models_temperatures_capacities")
          await resetIncrement(db, "asset_models_non_temperatures_capacities")
          await resetIncrement(db, "asset_models")
        }

        console.log("🧹 Truncate cleanup done, continue migration...")
      }
    } catch (err) {
      console.error("❌ Error during truncate cleanup:", err)
    }
  }

  // ========================
  // PRE MAIN MIGRATION LOOP
  // ========================

  // proses mapping platform ke asset v3
  const userSet = await mappingGlobalIds("user", "mapping_users", programId)

  const manufactureSet = await mappingGlobalIds(
    "manufacture",
    "mapping_manufactures",
    programId
  )

  const cceSet = await mappingIds("cce", "mapping_cce", programId)

  const assetTypeSet = await mappingIds(
    "asset_type",
    "mapping_asset_types",
    programId
  )

  // ========================
  // MAIN MIGRATION LOOP
  // ========================
  while (true) {
    const modelsV3 = await migrationDb
      .selectFrom("asset_model as am")
      .innerJoin("asset_type_model_manufacture as atmm", (join) =>
        join.onRef("am.id", "=", "atmm.asset_model_id")
      )
      .innerJoin("asset_type as at", (join) =>
        join.onRef("atmm.asset_type_id", "=", "at.id")
      )
      .leftJoin("coldchain_capacity_equipment as cce", (join) =>
        join.onRef("atmm.coldchain_capacity_equipment_id", "=", "cce.id")
      )
      .select([
        "am.id",
        "am.name",
        "am.capacity_nett",
        "am.capacity_gross",
        "am.capacity_nett_2",
        "am.capacity_gross_2",
        "am.capacity_nett_3",
        "am.capacity_gross_3",
        "am.created_by",
        "am.updated_by",
        "am.created_at",
        "am.updated_at",
        "am.deleted_at",
        "atmm.asset_type_id",
        "atmm.manufacture_id",
        "atmm.coldchain_capacity_equipment_id",
        "at.min_temp",
        "at.max_temp",
        "at.min_temp_2",
        "at.max_temp_2",
        "at.min_temp_3",
        "at.max_temp_3",
        "at.is_coldstorage",
        "cce.capacity_nett_at_plus_5_c",
        "cce.capacity_nett_at_minus_20_c",
        "cce.capacity_nett_at_minus_86_c",
      ])
      .orderBy("am.id")
      .limit(limit)
      .offset(offset)
      .execute()

    if (modelsV3.length === 0) break

    // proses mapping platform_asset_type_id ke v3
    const mappingAssetTypeIds = modelsV3.map((v3) => v3.asset_type_id)

    const mappingAssetTypes = await syncDB
      .selectFrom("mapping_asset_types")
      .select([
        "program_id",
        "platform_asset_type_id",
        "existing_asset_type_id",
      ])
      .where("program_id", "=", programId)
      .where("existing_asset_type_id", "in", mappingAssetTypeIds)
      .execute()

    // add platform material and manufacture id to v3
    const updateModelsV3Raw = modelsV3.map(async (m) => ({
      ...m,
      platform_manufacture_id: manufactureSet.get(m.manufacture_id) ?? null,
      platform_cce_id: cceSet.get(m.coldchain_capacity_equipment_id) ?? null,
      platform_asset_type_id: assetTypeSet.get(m.asset_type_id) ?? null,
      platform_user_created_id: userSet.get(m.created_by) ?? null,
      platform_user_updated_id: userSet.get(m.updated_by) ?? null,
    }))

    const updateModelsV3 = await Promise.all(updateModelsV3Raw)

    // collect platform asset type ids
    const platformAssetTypeIds = mappingAssetTypes.map(
      (item) => item.platform_asset_type_id
    )

    // proses mapping asset type temperature id ke v3
    const mappingAssetTypeTemperature = await db
      .selectFrom("asset_types as at")
      .leftJoin("asset_types_temperatures as att", (join) =>
        join
          .onRef("at.id", "=", "att.asset_type_id")
          .on("att.deleted_at", "is", null)
      )
      .select(["at.id", "att.id as att_id"])
      .where("at.id", "in", platformAssetTypeIds)
      .orderBy("at.id")
      .orderBy("att.id")
      .execute()

    const tempMap = mappingAssetTypeTemperature.reduce((acc, row) => {
      if (!acc[row.id]) acc[row.id] = []
      acc[row.id].push(row.att_id)
      return acc
    }, {})

    const enrichedModelsV3 = updateModelsV3.map((row) => {
      const temps = tempMap[row.platform_asset_type_id] || []
      const newRow = { ...row }

      temps.forEach((tempId, i) => {
        const index = i + 1
        newRow[`temperature_threshold_id_${index}`] = tempId
      })

      return newRow
    })

    // tambahkan hasil query batch ini ke list besar
    allModelsV3.push(...enrichedModelsV3)

    await db.transaction().execute(async (trx: Transaction<DB>) => {
      // --- 1) Sinkron volume_materials ---
      const existingV5 = await trx
        .selectFrom("asset_models")
        .select([
          "id",
          "name",
          "asset_type_id",
          "manufacture_id",
          "pqs_code_id",
        ])
        .orderBy("id")
        .execute()

      const nameToV5Id = new Map<string, number>()
      for (const e of existingV5) {
        nameToV5Id.set(makeKey(e.name, e.asset_type_id, e.manufacture_id), e.id)
        modelV5Ids.set(makeKey(e.name, e.asset_type_id, e.manufacture_id), e.id)
      }

      // Insert baru jika belum ada
      for (const m of enrichedModelsV3) {
        const key = makeKey(
          m.name,
          m.platform_asset_type_id,
          m.platform_manufacture_id
        )
        if (
          !nameToV5Id.get(key) &&
          m.platform_asset_type_id !== null &&
          m.platform_manufacture_id !== null
        ) {
          try {
            const inserted = await trx
              .insertInto("asset_models")
              .values({
                name: m.name,
                asset_type_id: m.platform_asset_type_id,
                manufacture_id: m.platform_manufacture_id,
                pqs_code_id: m.platform_cce_id,
                created_at: m.created_at ? new Date(m.created_at) : now,
                created_by: m.platform_user_created_id,
                updated_at: m.updated_at ? new Date(m.updated_at) : now,
                updated_by: m.platform_user_updated_id,
                deleted_at: m.deleted_at ? new Date(m.deleted_at) : null,
              })
              .executeTakeFirst()

            if (inserted) {
              total += 1
              const modelInserted = await trx
                .selectFrom("asset_models")
                .select(["id", "name", "manufacture_id", "asset_type_id"])
                .where("id", "=", inserted.insertId)
                .executeTakeFirst()

              if (
                m.is_coldstorage &&
                m.temperature_threshold_id_1 &&
                (m.capacity_nett_at_plus_5_c !== null ||
                  m.capacity_nett !== null ||
                  m.capacity_gross !== null)
              ) {
                await trx
                  .insertInto("asset_models_temperatures_capacities")
                  .values({
                    asset_model_id: modelInserted.id,
                    asset_type_temperature_id: m.temperature_threshold_id_1,
                    net_capacity: m.capacity_nett,
                    gross_capacity: m.capacity_gross,
                    created_at: m.created_at ? new Date(m.created_at) : now,
                    created_by: m.platform_user_created_id,
                    updated_at: m.updated_at ? new Date(m.updated_at) : now,
                    updated_by: m.platform_user_updated_id,
                    deleted_at: m.deleted_at ? new Date(m.deleted_at) : null,
                  })
                  .executeTakeFirst()
              }

              if (
                m.is_coldstorage &&
                m.temperature_threshold_id_2 &&
                (m.capacity_nett_at_minus_20_c !== null ||
                  m.capacity_nett_2 !== null ||
                  m.capacity_gross_2 !== null)
              ) {
                await trx
                  .insertInto("asset_models_temperatures_capacities")
                  .values({
                    asset_model_id: modelInserted.id,
                    asset_type_temperature_id: m.temperature_threshold_id_2,
                    net_capacity: m.capacity_nett_2,
                    gross_capacity: m.capacity_gross_2,
                    created_at: m.created_at ? new Date(m.created_at) : now,
                    created_by: m.platform_user_created_id,
                    updated_at: m.updated_at ? new Date(m.updated_at) : now,
                    updated_by: m.platform_user_updated_id,
                    deleted_at: m.deleted_at ? new Date(m.deleted_at) : null,
                  })
                  .executeTakeFirst()
              }

              if (
                m.is_coldstorage &&
                m.temperature_threshold_id_3 &&
                (m.capacity_nett_at_minus_86_c !== null ||
                  m.capacity_nett_3 !== null ||
                  m.capacity_gross_3 !== null)
              ) {
                await trx
                  .insertInto("asset_models_temperatures_capacities")
                  .values({
                    asset_model_id: modelInserted.id,
                    asset_type_temperature_id: m.temperature_threshold_id_3,
                    net_capacity: m.capacity_nett_3,
                    gross_capacity: m.capacity_gross_3,
                    created_at: m.created_at ? new Date(m.created_at) : now,
                    created_by: m.platform_user_created_id,
                    updated_at: m.updated_at ? new Date(m.updated_at) : now,
                    updated_by: m.platform_user_updated_id,
                    deleted_at: m.deleted_at ? new Date(m.deleted_at) : null,
                  })
                  .executeTakeFirst()
              }

              if (
                !m.is_coldstorage &&
                (m.capacity_nett !== null || m.capacity_gross !== null)
              ) {
                await trx
                  .insertInto("asset_models_non_temperatures_capacities")
                  .values({
                    asset_model_id: modelInserted.id,
                    net_capacity: m.capacity_nett,
                    gross_capacity: m.capacity_gross,
                    created_at: m.created_at ? new Date(m.created_at) : now,
                    created_by: m.platform_user_created_id,
                    updated_at: m.updated_at ? new Date(m.updated_at) : now,
                    updated_by: m.platform_user_updated_id,
                    deleted_at: m.deleted_at ? new Date(m.deleted_at) : null,
                  })
                  .executeTakeFirst()
              }

              if (
                !m.is_coldstorage &&
                (m.capacity_nett_2 !== null || m.capacity_gross_2 !== null)
              ) {
                await trx
                  .insertInto("asset_models_non_temperatures_capacities")
                  .values({
                    asset_model_id: modelInserted.id,
                    net_capacity: m.capacity_nett_2,
                    gross_capacity: m.capacity_gross_2,
                    created_at: m.created_at ? new Date(m.created_at) : now,
                    created_by: m.platform_user_created_id,
                    updated_at: m.updated_at ? new Date(m.updated_at) : now,
                    updated_by: m.platform_user_updated_id,
                    deleted_at: m.deleted_at ? new Date(m.deleted_at) : null,
                  })
                  .executeTakeFirst()
              }

              if (
                !m.is_coldstorage &&
                (m.capacity_nett_3 !== null || m.capacity_gross_3 !== null)
              ) {
                await trx
                  .insertInto("asset_models_non_temperatures_capacities")
                  .values({
                    asset_model_id: modelInserted.id,
                    net_capacity: m.capacity_nett_3,
                    gross_capacity: m.capacity_gross_3,
                    created_at: m.created_at ? new Date(m.created_at) : now,
                    created_by: m.platform_user_created_id,
                    updated_at: m.updated_at ? new Date(m.updated_at) : now,
                    updated_by: m.platform_user_updated_id,
                    deleted_at: m.deleted_at ? new Date(m.deleted_at) : null,
                  })
                  .executeTakeFirst()
              }

              nameToV5Id.set(
                makeKey(
                  modelInserted?.name,
                  modelInserted?.asset_type_id,
                  modelInserted?.manufacture_id
                ),
                modelInserted.id
              )
              modelV5Ids.set(
                makeKey(
                  modelInserted?.name,
                  modelInserted?.asset_type_id,
                  modelInserted?.manufacture_id
                ),
                modelInserted.id
              )
            }
          } catch (err) {
            console.error(
              "❌ Failed inserting asset models:",
              makeKey(
                m.name,
                m.platform_asset_type_id,
                m.platform_manufacture_id
              ),
              err
            )
          }
        } else {
          modelV5Ids.set(key, nameToV5Id.get(key))
        }
      }
    }) // end trx

    offset += limit
  } // end while

  // ========================
  // FINAL TRUNCATE STEP (hapus mapping)
  // ========================
  if (truncate && targetPlatformIds.length > 0) {
    console.log(
      `🧹 Final truncate step: deleting mapping for ${targetPlatformIds} platform IDs`
    )
    await syncDB
      .deleteFrom("mapping_asset_models")
      .where("platform_asset_model_id", "in", targetPlatformIds)
      .where("program_id", "=", programId)
      .execute()

    await resetIncrement(syncDB, "mapping_asset_models")
  }

  // ========================
  // FINAL MAPPING SINKRONISASI
  // ========================

  for (const v3 of allModelsV3) {
    const key = makeKey(
      v3.name,
      v3.platform_asset_type_id,
      v3.platform_manufacture_id
    )
    const newV5Id = modelV5Ids.get(key)
    if (!newV5Id) continue

    // `platform_asset_model_id` dianggap sebagai data global karena sebagai data master
    const exists = await syncDB
      .selectFrom("mapping_asset_models")
      .select("id")
      .where("program_id", "=", programId)
      .where("platform_asset_model_id", "=", newV5Id)
      .where("existing_asset_model_id", "=", v3.id)
      .executeTakeFirst()

    if (!exists) {
      await syncDB
        .insertInto("mapping_asset_models")
        .values({
          program_id: programId,
          platform_asset_model_id: newV5Id,
          existing_asset_model_id: v3.id,
          created_at: now,
          updated_at: now,
        })
        .execute()
    }
  }

  console.timeEnd("⏱️ Full migration end at")
  console.log(`Total migrated rows processed: ${total}`)
}
