import { db as syncDB } from "@/common/infrastructure/database/index.js"
import { Transaction } from "kysely"
import { getMigrationDB } from "../../db.migration_iot_new.js"
import { db } from "../../db.platform.js"
import { resetIncrement } from "../../helper.js"
import { DB } from "../../types.platform.js"

const CHUNK_SIZE = 1000
const now = new Date()

const PREDEFINED_THRESHOLDS = [
  { min: 2, max: 8 },
  { min: -25, max: -15 },
  { min: -86, max: -40 },
]

// mengambil data platform global karena pqs sebagai data master
async function mappingIds(fieldString, tableName, programId) {
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

export async function migratePqsV3ToV5(
  limit = CHUNK_SIZE,
  programId: number = 1,
  truncate: boolean = false
) {
  console.time("⏱️ Full migration start at")
  const migrationDb = getMigrationDB()
  let offset = 0
  let total = 0
  const pqsV5Ids = new Map<string, number>()

  // simpan hasil step truncate 2b
  let targetPlatformIds: number[] = []

  // simpan semua data v3
  const allPqsV3: any[] = []

  // ========================
  // TRUNCATE FLOW
  // ========================
  if (truncate) {
    console.log("🧹 Running truncate cleanup before migration...")

    try {
      // 2a. ambil semua mapping (program_id + platform_cce_id)
      const mappingsGrouped = await syncDB
        .selectFrom("mapping_cce")
        .select(["program_id", "platform_cce_id"])
        .execute()

      if (mappingsGrouped.length > 0) {
        // group platform_cce_id -> set(program_id)
        const platformIdToPrograms = new Map<number, Set<number>>()
        for (const m of mappingsGrouped) {
          const set =
            platformIdToPrograms.get(m.platform_cce_id) ?? new Set<number>()
          set.add(m.program_id)
          platformIdToPrograms.set(m.platform_cce_id, set)
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
          // 3. delete master table: pqs
          await db
            .deleteFrom("pqs_net_capacities")
            .where("pqs_code_id", "in", targetPlatformIds)
            .execute()

          await db
            .deleteFrom("pqs_codes")
            .where("id", "in", targetPlatformIds)
            .execute()

          // 4. reset autoincrement untuk tabel yang dihapus
          await resetIncrement(db, "pqs_net_capacities")
          await resetIncrement(db, "pqs_codes")
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
  const userSet = await mappingIds("user", "mapping_users", programId)

  // ========================
  // MAIN MIGRATION LOOP
  // ========================
  while (true) {
    // get standar data suhu 5.0
    const temperatureThresholds = await db
      .selectFrom("temperature_thresholds")
      .where((eb) =>
        eb.or(
          PREDEFINED_THRESHOLDS.map(({ min, max }) =>
            eb.and([
              eb("min_temperature", "=", min),
              eb("max_temperature", "=", max),
            ])
          )
        )
      )
      .where("is_predefined", "=", 1)
      .select("id")
      .execute()

    // get data pqs dari 3.0
    const pqsV3 = await migrationDb
      .selectFrom("coldchain_capacity_equipment as cce")
      .select([
        "cce.id",
        "cce.code_pqs",
        "cce.capacity_nett_at_plus_5_c",
        "cce.capacity_nett_at_minus_20_c",
        "cce.capacity_nett_at_minus_86_c",
        "cce.type_pqs_id",
        "cce.designation_cceigat_id",
        "cce.created_by",
        "cce.updated_by",
        "cce.deleted_by",
        "cce.created_at",
        "cce.updated_at",
        "cce.deleted_at",
      ])
      .orderBy("cce.id")
      .limit(limit)
      .offset(offset)
      .execute()

    if (pqsV3.length === 0) break

    // proses mapping dengan standard temperature di 5.0
    const excludedKeys = [
      "id",
      "code_pqs",
      "type_pqs_id",
      "designation_cceigat_id",
      "created_by",
      "updated_by",
      "deleted_by",
      "created_at",
      "updated_at",
      "deleted_at",
    ]
    const enrichedPqsV3Temp = pqsV3.map((row) => {
      // const keys = Object.keys(row).filter((k) => k !== "id")
      const keys = Object.keys(row).filter((k) => !excludedKeys.includes(k))
      const newRow = { ...row }

      keys.forEach((key, i) => {
        const range = temperatureThresholds[i]
        if (range) {
          // tambahkan kolom baru dengan nama <key>_<id> dari threshold temperatures
          const index = i + 1
          newRow[`${key}_${index}`] = range.id
        }
      })

      return newRow
    })

    const enrichedPqsV3Raw = enrichedPqsV3Temp.map(async (m) => ({
      ...m,
      platform_user_created_id: userSet.get(m.created_by) ?? null,
      platform_user_updated_id: userSet.get(m.updated_by) ?? null,
      platform_user_deleted_id: userSet.get(m.deleted_by) ?? null,
    }))

    // tambahkan hasil query batch ini ke list besar
    const enrichedPqsV3 = await Promise.all(enrichedPqsV3Raw)

    allPqsV3.push(...enrichedPqsV3)

    await db.transaction().execute(async (trx: Transaction<DB>) => {
      // --- 1) Sinkron pqs ---
      const codes = enrichedPqsV3
        .map((r) => r.code_pqs ?? null)
        .filter((n): n is string => n !== null)

      const existingV5 = await trx
        .selectFrom("pqs_codes as pc")
        .leftJoin("pqs_net_capacities as pnc", (join) =>
          join
            .onRef("pc.id", "=", "pnc.pqs_code_id")
            .on("pnc.deleted_at", "is", null)
        )
        .select([
          "pc.id",
          "pc.code",
          "pc.pqs_type_id",
          "pc.cceigat_description_id",
          "pnc.temperature_threshold_id",
          "pnc.net_capacity",
        ])
        .where("pc.code", "in", codes)
        .orderBy("pc.id")
        .execute()

      const nameToV5Id = new Map<string, number>()
      for (const e of existingV5) {
        nameToV5Id.set(e.code, e.id)
        pqsV5Ids.set(e.code, e.id)
      }

      // Insert baru jika belum ada
      for (const [i, p] of enrichedPqsV3.entries()) {
        const index = i + 1
        if (!nameToV5Id.get(p.code_pqs)) {
          try {
            const inserted = await trx
              .insertInto("pqs_codes")
              .values({
                code: p.code_pqs,
                pqs_type_id: p.type_pqs_id,
                cceigat_description_id: p.designation_cceigat_id,
                created_at: p.created_at ? new Date(p.created_at) : now,
                created_by: p.platform_user_created_id,
                updated_at: p.updated_at ? new Date(p.updated_at) : now,
                updated_by: p.platform_user_updated_id,
                deleted_at: p.deleted_at ? new Date(p.deleted_at) : null,
                deleted_by: p.platform_user_deleted_id,
              })
              .executeTakeFirst()

            if (inserted) {
              total += 1
              const pqsInserted = await trx
                .selectFrom("pqs_codes")
                .select(["id", "code"])
                .where("id", "=", inserted.insertId)
                .executeTakeFirst()

              if (p.capacity_nett_at_plus_5_c !== null) {
                await trx
                  .insertInto("pqs_net_capacities")
                  .values({
                    pqs_code_id: pqsInserted.id,
                    temperature_threshold_id: p.capacity_nett_at_plus_5_c_1,
                    net_capacity: p.capacity_nett_at_plus_5_c,
                    created_at: p.created_at ? new Date(p.created_at) : now,
                    created_by: p.platform_user_created_id,
                    updated_at: p.updated_at ? new Date(p.updated_at) : now,
                    updated_by: p.platform_user_updated_id,
                    deleted_at: p.deleted_at ? new Date(p.deleted_at) : null,
                    deleted_by: p.platform_user_deleted_id,
                  })
                  .executeTakeFirst()
              }

              if (p.capacity_nett_at_minus_20_c !== null) {
                await trx
                  .insertInto("pqs_net_capacities")
                  .values({
                    pqs_code_id: pqsInserted.id,
                    temperature_threshold_id: p.capacity_nett_at_minus_20_c_2,
                    net_capacity: p.capacity_nett_at_minus_20_c,
                    created_at: p.created_at ? new Date(p.created_at) : now,
                    created_by: p.platform_user_created_id,
                    updated_at: p.updated_at ? new Date(p.updated_at) : now,
                    updated_by: p.platform_user_updated_id,
                    deleted_at: p.deleted_at ? new Date(p.deleted_at) : null,
                    deleted_by: p.platform_user_deleted_id,
                  })
                  .executeTakeFirst()
              }

              if (p.capacity_nett_at_minus_86_c !== null) {
                await trx
                  .insertInto("pqs_net_capacities")
                  .values({
                    pqs_code_id: pqsInserted.id,
                    temperature_threshold_id: p.capacity_nett_at_minus_86_c_3,
                    net_capacity: p.capacity_nett_at_minus_86_c,
                    created_at: p.created_at ? new Date(p.created_at) : now,
                    created_by: p.platform_user_created_id,
                    updated_at: p.updated_at ? new Date(p.updated_at) : now,
                    updated_by: p.platform_user_updated_id,
                    deleted_at: p.deleted_at ? new Date(p.deleted_at) : null,
                    deleted_by: p.platform_user_deleted_id,
                  })
                  .executeTakeFirst()
              }

              nameToV5Id.set(pqsInserted.code, pqsInserted.id)
              pqsV5Ids.set(pqsInserted.code, pqsInserted.id)
            }
          } catch (err) {
            console.error("❌ Failed inserting pqs:", p.code_pqs, err)
          }
        } else {
          pqsV5Ids.set(p.code_pqs, nameToV5Id.get(p.code_pqs))
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
      .deleteFrom("mapping_cce")
      .where("platform_cce_id", "in", targetPlatformIds)
      .where("program_id", "=", programId)
      .execute()

    await resetIncrement(syncDB, "mapping_cce")
  }

  // ========================
  // FINAL MAPPING SINKRONISASI
  // ========================

  for (const v3 of allPqsV3) {
    const newV5Id = pqsV5Ids.get(v3.code_pqs)
    if (!newV5Id) continue

    // `platform_cce_id` dianggap sebagai data global karena sebagai data master
    const exists = await syncDB
      .selectFrom("mapping_cce")
      .select("id")
      .where("program_id", "=", programId)
      .where("platform_cce_id", "=", newV5Id)
      .where("existing_cce_id", "=", v3.id)
      .executeTakeFirst()

    if (!exists) {
      await syncDB
        .insertInto("mapping_cce")
        .values({
          program_id: programId,
          platform_cce_id: newV5Id,
          existing_cce_id: v3.id,
          created_at: now,
          updated_at: now,
        })
        .execute()
    }
  }

  console.timeEnd("⏱️ Full migration end at")
  console.log(`Total migrated rows processed: ${total}`)
}
