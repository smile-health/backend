import { Transaction, sql } from "kysely"
import { db } from "../../db.platform.js"
import { resetIncrement } from "../../helper.js"
import { DB } from "../../types.platform.js"

const CHUNK_SIZE = 1000
const PREDEFINED_THRESHOLDS = new Set(["2-8", "-25--15", "-86--40"])

function isPredefined(
  min: number | null | undefined,
  max: number | null | undefined
): 1 | 0 {
  if (min == null || max == null) return 0
  return PREDEFINED_THRESHOLDS.has(`${min}-${max}`) ? 1 : 0
}

function getClassificationId(
  min: number | null | undefined,
  max: number | null | undefined
): number {
  if (min == null || max == null) return 2
  return PREDEFINED_THRESHOLDS.has(`${min}-${max}`) ? 1 : 2
}

export async function migrateAssetTypesLogistic(
  limit = CHUNK_SIZE,
  truncate: boolean = false
) {
  console.time("⏱️ Migration start at")
  let offset = 0
  let totalMigrated = 0

  if (truncate) {
    await sql`
    DELETE FROM asset_types_temperatures
  `.execute(db)

    await sql`
    DELETE FROM temperature_thresholds
  `.execute(db)

    await sql`
    DELETE FROM asset_types_classifications`.execute(db)

    await resetIncrement(db, "asset_types_temperatures")
    await resetIncrement(db, "temperature_thresholds")
    await resetIncrement(db, "asset_types_classifications")
  }

  while (true) {
    const batchStartTime = Date.now()
    const now = new Date()

    const done = await db
      .transaction()
      .execute(async (trx: Transaction<DB>) => {
        // 1. Ambil batch asset_types tanpa filter min/max null (karena perlu update classification jika null)
        const assets = await trx
          .selectFrom("asset_types")
          .select([
            "id",
            "min_temperature",
            "max_temperature",
            "created_by",
            "updated_by",
            "deleted_by",
            "created_at",
            "updated_at",
            "deleted_at",
          ])
          .orderBy("id")
          .limit(limit)
          .offset(offset)
          .execute()

        if (assets.length === 0) return true // done

        // 2. Insert atau Update asset types classifications
        const classificationData = assets.map((asset) => ({
          asset_type_id: asset.id,
          asset_classifications_id: getClassificationId(
            typeof asset.min_temperature === "string"
              ? Number(asset.min_temperature)
              : asset.min_temperature,
            typeof asset.max_temperature === "string"
              ? Number(asset.max_temperature)
              : asset.max_temperature
          ),
          created_by: asset.created_by,
          updated_by: asset.updated_by,
          deleted_by: asset.deleted_by,
          created_at: asset.created_at ? new Date(asset.created_at) : now,
          updated_at: asset.updated_at ? new Date(asset.updated_at) : now,
          deleted_at: asset.deleted_at ? new Date(asset.deleted_at) : null,
        }))

        const existingClassificationIds = await trx
          .selectFrom("asset_types_classifications")
          .select(["asset_type_id"])
          .where(
            "asset_type_id",
            "in",
            classificationData.map((r) => r.asset_type_id)
          )
          .execute()

        const existingSet = new Set(
          existingClassificationIds.map((r) => r.asset_type_id)
        )

        const toInsert = classificationData.filter(
          (row) => !existingSet.has(row.asset_type_id)
        )
        const toUpdate = classificationData.filter((row) =>
          existingSet.has(row.asset_type_id)
        )

        if (toInsert.length > 0) {
          await trx
            .insertInto("asset_types_classifications")
            .values(toInsert)
            .execute()
        }

        for (const row of toUpdate) {
          await trx
            .updateTable("asset_types_classifications")
            .set({
              asset_classifications_id: row.asset_classifications_id,
              updated_at: row.updated_at ? new Date(row.updated_at) : now,
              updated_by: row.updated_by,
            })
            .where("asset_type_id", "=", row.asset_type_id)
            .execute()
        }

        // === Hapus duplikat asset_types_classifications ===

        const dupes = await trx
          .selectFrom("asset_types_classifications")
          .select(["asset_type_id", trx.fn.count("id").as("count")])
          .groupBy("asset_type_id")
          .having((eb) => eb.fn.count("id"), ">", 1)
          .execute()

        if (dupes.length > 0) {
          const dupeIds = await trx
            .selectFrom("asset_types_classifications")
            .select(["id", "asset_type_id"])
            .where(
              "asset_type_id",
              "in",
              dupes.map((d) => d.asset_type_id)
            )
            .orderBy("id", "asc")
            .execute()

          const grouped = new Map<number, number[]>()
          for (const row of dupeIds) {
            if (!grouped.has(row.asset_type_id))
              grouped.set(row.asset_type_id, [])
            grouped.get(row.asset_type_id)!.push(row.id)
          }

          const idsToDelete: number[] = []
          for (const ids of grouped.values()) {
            if (ids.length > 1) {
              const [, ...rest] = ids
              idsToDelete.push(...rest)
            }
          }

          if (idsToDelete.length > 0) {
            await trx
              .deleteFrom("asset_types_classifications")
              .where("id", "in", idsToDelete)
              .execute()
          }
        }

        // 3. Filter assets dengan min/max valid
        const validAssets = assets.filter(
          (a) => a.min_temperature != null && a.max_temperature != null
        )

        // 4. Build key set & mapping min/max -> key
        const tempKeySet = new Map<string, { min: number; max: number }>()
        const assetToTempKey = validAssets.map((row) => {
          const min =
            typeof row.min_temperature === "string"
              ? Number(row.min_temperature)
              : row.min_temperature!
          const max =
            typeof row.max_temperature === "string"
              ? Number(row.max_temperature)
              : row.max_temperature!
          const key = `${min}-${max}`
          const created_by = row.created_by
          const updated_by = row.updated_by
          const deleted_by = row.deleted_by
          const created_at = row.created_at ? new Date(row.created_at) : now
          const updated_at = row.updated_at ? new Date(row.updated_at) : now
          const deleted_at = row.deleted_at ? new Date(row.deleted_at) : null
          tempKeySet.set(key, { min, max })
          return {
            asset_type_id: row.id,
            key,
            min,
            max,
            created_by,
            updated_by,
            deleted_by,
            created_at,
            updated_at,
            deleted_at,
          }
        })

        // 5. Ambil semua temperature_thresholds yg ada dan buat map key->threshold
        const existingThresholds = await trx
          .selectFrom("temperature_thresholds")
          .select(["id", "min_temperature", "max_temperature"])
          .execute()

        const thresholdMap = new Map<
          string,
          { id: number; min: number; max: number }
        >()
        for (const t of existingThresholds) {
          const key = `${t.min_temperature}-${t.max_temperature}`
          thresholdMap.set(key, {
            id: t.id,
            min: t.min_temperature,
            max: t.max_temperature,
          })
        }

        // 6. Insert temperature_thresholds baru yg belum ada
        for (const [key, { min, max }] of tempKeySet.entries()) {
          if (!thresholdMap.has(key)) {
            await trx
              .insertInto("temperature_thresholds")
              .values({
                min_temperature: min,
                max_temperature: max,
                is_predefined: isPredefined(min, max),
              })
              .execute()

            // Ambil id baru setelah insert
            const inserted = await trx
              .selectFrom("temperature_thresholds")
              .select("id")
              .where("min_temperature", "=", min)
              .where("max_temperature", "=", max)
              .executeTakeFirst()

            if (!inserted)
              throw new Error(`Failed to get inserted threshold id for ${key}`)

            thresholdMap.set(key, { id: inserted.id, min, max })
          }
        }

        // 7. Hapus duplikat temperature_thresholds, sisakan satu canonical
        const allThresholds = await trx
          .selectFrom("temperature_thresholds")
          .select(["id", "min_temperature", "max_temperature"])
          .execute()

        const canonicalIdByKey = new Map<string, number>()
        const duplicateThresholdIds: number[] = []

        for (const t of allThresholds) {
          const key = `${t.min_temperature}-${t.max_temperature}`
          if (canonicalIdByKey.has(key)) {
            duplicateThresholdIds.push(t.id)
          } else {
            canonicalIdByKey.set(key, t.id)
          }
        }

        if (duplicateThresholdIds.length > 0) {
          await trx
            .deleteFrom("temperature_thresholds")
            .where("id", "in", duplicateThresholdIds)
            .execute()
        }

        // 8. Handle asset_types_temperatures relasi
        // Ambil data relasi existing
        const existingRelations = await trx
          .selectFrom("asset_types_temperatures")
          .select(["id", "asset_type_id", "temperature_threshold_id"])
          .execute()

        if (existingRelations.length === 0) {
          // Insert semua relasi sekaligus jika kosong
          const pivotData = assetToTempKey.map((row) => {
            const threshold = thresholdMap.get(row.key)!
            return {
              asset_type_id: row.asset_type_id,
              temperature_threshold_id: threshold.id,
              created_at: row.created_at,
              created_by: row.created_by,
              updated_at: row.updated_at,
              updated_by: row.updated_by,
              deleted_at: row.deleted_at,
              deleted_by: row.deleted_by,
            }
          })

          if (pivotData.length > 0) {
            await trx
              .insertInto("asset_types_temperatures")
              .values(pivotData)
              .execute()
          }
        } else {
          // Jika sudah ada data

          // 8.a. Map untuk cepat cari relasi by asset_type_id
          const relByAssetType = new Map<number, typeof existingRelations>()
          for (const rel of existingRelations) {
            if (!relByAssetType.has(rel.asset_type_id))
              relByAssetType.set(rel.asset_type_id, [])
            relByAssetType.get(rel.asset_type_id)!.push(rel)
          }

          // 8.b. Update temperature_threshold_id jika relasi berdasarkan asset_type_id sudah ada tapi threshold salah
          for (const {
            asset_type_id,
            temperature_threshold_id,
            id: relation_id,
          } of existingRelations) {
            const match = assetToTempKey.find(
              (row) => row.asset_type_id === asset_type_id
            )
            if (!match) continue

            const expectedKey = `${match.min}-${match.max}`
            const expectedThreshold = thresholdMap.get(expectedKey)
            if (!expectedThreshold) continue

            if (temperature_threshold_id !== expectedThreshold.id) {
              await trx
                .updateTable("asset_types_temperatures")
                .set({ temperature_threshold_id: expectedThreshold.id })
                .where("id", "=", relation_id)
                .execute()
            }
          }

          // 8.c. Insert relasi baru yang belum ada berdasarkan asset_type_id
          const existingAssetTypeIds = new Set(
            existingRelations.map((r) => r.asset_type_id)
          )
          const toInsert = assetToTempKey
            .filter((row) => !existingAssetTypeIds.has(row.asset_type_id))
            .map((row) => {
              const threshold = thresholdMap.get(row.key)!
              return {
                asset_type_id: row.asset_type_id,
                temperature_threshold_id: threshold.id,
                created_at: row.created_at,
                created_by: row.created_by,
                updated_at: row.updated_at,
                updated_by: row.updated_by,
                deleted_at: row.deleted_at,
                deleted_by: row.deleted_by,
              }
            })

          if (toInsert.length > 0) {
            await trx
              .insertInto("asset_types_temperatures")
              .values(toInsert)
              .execute()
          }

          // 8.d. Hapus duplikat asset_type_id di asset_types_temperatures, sisakan satu
          const updatedRelations = await trx
            .selectFrom("asset_types_temperatures")
            .select(["id", "asset_type_id"])
            .execute()

          const groupedByAssetType = new Map<number, number[]>()
          for (const rel of updatedRelations) {
            if (!groupedByAssetType.has(rel.asset_type_id))
              groupedByAssetType.set(rel.asset_type_id, [])
            groupedByAssetType.get(rel.asset_type_id)!.push(rel.id)
          }

          const toDeleteRelIds: number[] = []
          for (const [, ids] of groupedByAssetType.entries()) {
            if (ids.length > 1) {
              // Sisakan satu, hapus sisanya
              const [, ...remove] = ids
              toDeleteRelIds.push(...remove)
            }
          }

          if (toDeleteRelIds.length > 0) {
            await trx
              .deleteFrom("asset_types_temperatures")
              .where("id", "in", toDeleteRelIds)
              .execute()
          }
        }

        totalMigrated += assets.length
        return false // not done
      })

    if (done) break
    offset += limit
    console.log(
      `Migrated ${totalMigrated} records in ${(Date.now() - batchStartTime) / 1000}s`
    )
  }

  console.timeEnd("⏱️ Migration end at")
}
