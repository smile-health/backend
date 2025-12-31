import { getMigrationDB } from "@/scripts/db.migration.js"
import { db } from "@/scripts/db.platform.js"
import * as fs from "fs"
import * as path from "path"

interface ImunEntity {
  id: number
  name: string | null
  type: number | null
  province_id: number | null
  regency_id: number | null
  mapping_id_satu_sehat: number | null
  deleted_at: Date | null
  address: string | null
  village_id: string | null
  region_id: number | null
  created_by: number | null
  updated_by: number | null
  deleted_by: number | null
  created_at: Date | null
  updated_at: Date | null
  code: string | null
  status: number | null
  postal_code: string | null
  lat: string | null
  lng: string | null
  accuracy: string | null
  gps_errors: string | null
  country: string | null
  sub_district_id: string | null
  is_vendor: number | null
  bpom_key: string | null
  is_puskesmas: number | null
  rutin_join_date: Date | null
  is_ayosehat: number | null
  code_satu_sehat: string | null
  code_old: string | null
  code_new: string | null
  province_id_old: string | null
  province_id_new: string | null
  regency_id_old: string | null
  regency_id_new: string | null
  sub_district_id_old: string | null
  sub_district_id_new: string | null
  village_id_old: string | null
  village_id_new: string | null
  last_transaction_at: Date | null
}

interface V5Entity {
  id: number
  name: string | null
  id_satu_sehat: number | null
  type: number | null
  province_id: number | null
  regency_id: number | null
  deleted_at: Date | null
}

interface MatchedEntity {
  id: [number, number]
  name: [string, string]
  id_satu_sehat: [number | null, number | null]
}

// Helper: cek apakah nilai adalah string non-empty setelah trim
const isNonEmptyString = (value: unknown): value is string => {
  return typeof value === "string" && value.trim().length > 0
}

// Helper: cek apakah entity memenuhi kriteria matching tambahan
const meetsAdditionalCriteria = (imun: ImunEntity, v5: V5Entity): boolean => {
  const isTypeMatch = imun.type == v5.type
  const isProvinceMatch = imun.province_id == v5.province_id

  if (imun.type === 1) {
    return isTypeMatch && isProvinceMatch
  }

  const isRegencyMatch = imun.regency_id == v5.regency_id
  return isTypeMatch && isProvinceMatch && isRegencyMatch
}

// Helper: sinkronisasi id_satu_sehat antara Imun dan V5
const synchronizeIdSatuSehat = async (
  migrationDB: ReturnType<typeof getMigrationDB>,
  imunEntity: ImunEntity,
  v5Entity: V5Entity
) => {
  if (
    imunEntity.mapping_id_satu_sehat === null &&
    v5Entity.id_satu_sehat !== null
  ) {
    try {
      // Insert ke mapping_entities
      await migrationDB
        .insertInto("mapping_entities")
        .values({
          id_entitas_smile: imunEntity.id,
          id_satu_sehat: v5Entity.id_satu_sehat,
          created_at: new Date(),
          updated_at: new Date(),
        })
        .execute()

      console.log(
        `🔄 Inserted to mapping_entities: Imun ID ${imunEntity.id} -> IDSSH ${v5Entity.id_satu_sehat}`
      )
    } catch (error) {
      console.error(
        `❌ Failed to insert to mapping_entities for Imun ID ${imunEntity.id}:`,
        error
      )
    }
  }

  // Jika V5 id_satu_sehat null & di Imun ada
  if (
    v5Entity.id_satu_sehat === null &&
    imunEntity.mapping_id_satu_sehat !== null
  ) {
    try {
      // Update id_satu_sehat di V5
      await db
        .updateTable("entities")
        .set({
          id_satu_sehat: imunEntity.mapping_id_satu_sehat,
          updated_at: new Date(),
        })
        .where("id", "=", v5Entity.id)
        .execute()

      console.log(
        `🔄 Updated V5 entity ID ${v5Entity.id}: IDSSH null -> ${imunEntity.mapping_id_satu_sehat}`
      )
    } catch (error) {
      console.error(`❌ Failed to update V5 entity ID ${v5Entity.id}:`, error)
    }
  }
}

// Helper: insert entity dari Imun ke V5
const insertImunEntityToV5 = async (
  imunEntity: ImunEntity
): Promise<number | null> => {
  try {
    const result = await db.transaction().execute(async (trx) => {
      const insertValues: Record<
        string,
        string | number | Date | null | undefined
      > = {
        code: imunEntity.code,
        name: imunEntity.name,
        type: imunEntity.type !== null ? imunEntity.type : 0,
        status: imunEntity.status || 1,
        entity_tag_id: null, //to do
        address: imunEntity.address,
        country: imunEntity.country || "ID",
        province_id:
          imunEntity.province_id !== null
            ? String(imunEntity.province_id)
            : null,
        regency_id:
          imunEntity.regency_id !== null ? String(imunEntity.regency_id) : null,
        sub_district_id: imunEntity.sub_district_id || null,
        village_id: imunEntity.village_id || null,
        postal_code: imunEntity.postal_code,
        lat: imunEntity.lat,
        lng: imunEntity.lng,
        id_satu_sehat: imunEntity.mapping_id_satu_sehat,
        is_puskesmas: imunEntity.is_puskesmas || 0,
        is_vendor: imunEntity.is_vendor || 0,
        created_by: null,
        updated_by: null,
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null,
      }

      // Hapus field yang undefined
      Object.keys(insertValues).forEach((key) => {
        if (insertValues[key] === undefined) {
          delete insertValues[key]
        }
      })

      await trx.insertInto("entities").values(insertValues).execute()

      const lastInsertResult = await trx
        .selectFrom("entities")
        .select("id")
        .orderBy("id", "desc")
        .limit(1)
        .execute()

      if (lastInsertResult.length > 0 && lastInsertResult[0]?.id) {
        console.log(
          `✅ Inserted Imun entity to V5: "${imunEntity.name}" (ID: ${lastInsertResult[0].id})`
        )
        return lastInsertResult[0].id
      }
      return null
    })

    return result
  } catch (error) {
    console.error(
      `❌ Failed to insert Imun entity to V5: "${imunEntity.name}"`,
      error
    )
    return null
  }
}

export const compareEntity = async (programId: number, limit: number) => {
  const startTime = new Date()
  console.log(`🔍 Entity comparison started at: ${startTime.toLocaleString()}`)

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
  const fileName = `entity_comparison_${timestamp}.json`
  const outputDir = path.resolve("./comparison-results")
  const outputPath = path.join(outputDir, fileName)

  const migrationDB = getMigrationDB(programId)

  // Ambil data dari Imun dengan id_satu_sehat dari mapping_entities
  const entitiesImun = (await migrationDB
    .selectFrom("entities as e")
    .leftJoin("mapping_entities as me", (join) =>
      join.onRef("me.id_entitas_smile", "=", "e.id")
    )
    .selectAll("e")
    .select(["me.id_satu_sehat as mapping_id_satu_sehat"])
    .where("e.deleted_at", "is", null)
    .limit(limit)
    .execute()) as ImunEntity[]

  console.log(`📊 Found ${entitiesImun.length} entities in Imun`)

  // Deteksi dan handle duplikasi id_satu_sehat di Imun
  const duplicateIdSatuSehatReport: {
    id_satu_sehat: number
    duplicate_ids: number[]
    kept_id: number
  }[] = []

  const entitiesBySatuSehat = new Map<number, ImunEntity[]>()
  for (const entity of entitiesImun) {
    if (entity.mapping_id_satu_sehat !== null) {
      if (!entitiesBySatuSehat.has(entity.mapping_id_satu_sehat)) {
        entitiesBySatuSehat.set(entity.mapping_id_satu_sehat, [])
      }
      const entitiesArray = entitiesBySatuSehat.get(
        entity.mapping_id_satu_sehat
      )
      if (entitiesArray) {
        entitiesArray.push(entity)
      }
    }
  }

  // Filter entities untuk menghapus duplikat (hanya simpan satu entity per id_satu_sehat)
  const filteredEntitiesImun: ImunEntity[] = []
  const removedDuplicateIds = new Set<number>()

  for (const entity of entitiesImun) {
    if (entity.mapping_id_satu_sehat === null) {
      filteredEntitiesImun.push(entity)
      continue
    }

    const duplicates =
      entitiesBySatuSehat.get(entity.mapping_id_satu_sehat) || []
    if (duplicates.length > 1) {
      // Ambil entity pertama sebagai yang disimpan
      const keptEntity = duplicates[0]!
      if (entity.id === keptEntity.id) {
        filteredEntitiesImun.push(entity)

        // Buat laporan duplikat
        duplicateIdSatuSehatReport.push({
          id_satu_sehat: entity.mapping_id_satu_sehat,
          duplicate_ids: duplicates.map((e) => e.id),
          kept_id: keptEntity!.id, // Use non-null assertion since duplicates.length > 1 ensures keptEntity exists
        })
      } else {
        removedDuplicateIds.add(entity.id)
      }
    } else {
      filteredEntitiesImun.push(entity)
    }
  }

  // Tampilkan laporan duplikasi
  if (duplicateIdSatuSehatReport.length > 0) {
    console.log(`\n⚠️  DUPLICATE ID_SATU_SEHAT DETECTION REPORT`)
    console.log(
      `   Found ${duplicateIdSatuSehatReport.length} duplicate id_satu_sehat values`
    )

    duplicateIdSatuSehatReport.forEach((report, index) => {
      console.log(`\n   ${index + 1}. ID Satu Sehat: ${report.id_satu_sehat}`)
      console.log(`      → Kept Entity ID: ${report.kept_id}`)
      console.log(
        `      → Removed Entity IDs: ${report.duplicate_ids.filter((id) => id !== report.kept_id).join(", ")}`
      )
    })

    console.log(
      `\n   Total entities removed due to duplication: ${removedDuplicateIds.size}`
    )
  }

  console.log(
    `📊 After deduplication: ${filteredEntitiesImun.length} entities in Imun`
  )

  const matchedEntities: MatchedEntity[] = []
  const usedImun = new Set<number>()
  const usedV5 = new Set<number>()

  // Kumpulkan semua id_satu_sehat yang valid dari Imun
  const validIdSatuSehat = new Set<number>()
  const namesWithoutId = new Set<string>()

  for (const imunEntity of filteredEntitiesImun) {
    if (imunEntity.mapping_id_satu_sehat !== null) {
      validIdSatuSehat.add(imunEntity.mapping_id_satu_sehat)
    } else if (imunEntity.name && isNonEmptyString(imunEntity.name)) {
      namesWithoutId.add(imunEntity.name.trim())
    }
  }

  let v5EntitiesById: V5Entity[] = []
  if (validIdSatuSehat.size > 0) {
    v5EntitiesById = (await db
      .selectFrom("entities")
      .select([
        "id",
        "name",
        "id_satu_sehat",
        "type",
        "province_id",
        "regency_id",
        "deleted_at",
      ])
      .where("id_satu_sehat", "in", Array.from(validIdSatuSehat))
      .where("deleted_at", "is", null)
      .execute()) as V5Entity[]
  }

  let v5EntitiesByName: V5Entity[] = []
  if (namesWithoutId.size > 0) {
    v5EntitiesByName = (await db
      .selectFrom("entities")
      .select([
        "id",
        "name",
        "id_satu_sehat",
        "type",
        "province_id",
        "regency_id",
        "deleted_at",
      ])
      .where("name", "in", Array.from(namesWithoutId))
      .where("deleted_at", "is", null)
      .execute()) as V5Entity[]
  }

  let allV5Entities = [...v5EntitiesById, ...v5EntitiesByName]

  // Filter entitas V5 yang non-aktif
  allV5Entities = allV5Entities.filter((entity) => {
    const isNonAktif =
      entity.name &&
      (entity.name.includes("[NON AKTIF]") ||
        entity.name.includes("(NON AKTIF)") ||
        entity.name.includes("NON-AKTIF") ||
        entity.name.toLowerCase().includes("non aktif") ||
        entity.name.includes("TIDAK AKTIF") ||
        entity.name.includes("NONACTIVE"))

    if (isNonAktif) {
      return false
    }

    return true
  })

  // Buat mapping untuk pencarian cepat
  const v5ByIdMap = new Map<number, V5Entity>()
  const v5ByNameMap = new Map<string, V5Entity[]>()

  for (const v5Entity of allV5Entities) {
    if (v5Entity.id_satu_sehat !== null) {
      v5ByIdMap.set(v5Entity.id_satu_sehat, v5Entity)
    }
    if (v5Entity.name) {
      if (!v5ByNameMap.has(v5Entity.name)) {
        v5ByNameMap.set(v5Entity.name, [])
      }
      const entitiesArray = v5ByNameMap.get(v5Entity.name)
      if (entitiesArray) {
        entitiesArray.push(v5Entity)
      }
    }
  }

  // Proses matching untuk setiap entity Imun (setelah deduplikasi)
  for (const imunEntity of filteredEntitiesImun) {
    let v5Entity: V5Entity | undefined = undefined

    // 1. Cari berdasarkan id_satu_sehat di database V5
    if (imunEntity.mapping_id_satu_sehat !== null) {
      v5Entity = v5ByIdMap.get(imunEntity.mapping_id_satu_sehat)
      if (v5Entity) {
        // Match by id_satu_sehat
      }
    }

    // 2. Cari berdasarkan name (jika belum ketemu berdasarkan id_satu_sehat)
    if (!v5Entity && imunEntity.name && isNonEmptyString(imunEntity.name)) {
      const name = imunEntity.name.trim()

      // Cari exact match terlebih dahulu
      let potentialMatches = v5ByNameMap.get(name) || []

      // Jika tidak ketemu exact match, cari case-insensitive match
      if (potentialMatches.length === 0) {
        const lowerName = name.toLowerCase()
        for (const [v5Name, v5Entities] of v5ByNameMap.entries()) {
          if (v5Name.toLowerCase() === lowerName) {
            potentialMatches = v5Entities
            break
          }
        }
      }

      // Cari match yang memenuhi kriteria tambahan
      for (const potentialMatch of potentialMatches) {
        const criteriaMatch = meetsAdditionalCriteria(
          imunEntity,
          potentialMatch
        )

        if (criteriaMatch) {
          v5Entity = potentialMatch
          // Match by name
          break
        }
      }
    }

    // 3. Jika ditemukan dan belum digunakan, tambahkan ke matched
    if (v5Entity && !usedV5.has(v5Entity.id)) {
      matchedEntities.push({
        id: [imunEntity.id, v5Entity.id],
        name: [imunEntity.name || "", v5Entity.name || ""],
        id_satu_sehat: [
          imunEntity.mapping_id_satu_sehat,
          v5Entity.id_satu_sehat,
        ],
      })
      usedImun.add(imunEntity.id)
      usedV5.add(v5Entity.id)

      // 4. Sinkronisasi id_satu_sehat antara Imun dan V5
      await synchronizeIdSatuSehat(migrationDB, imunEntity, v5Entity)
    }
  }

  // Cari yang missing di V5 (entities Imun yang tidak ditemukan di V5)
  const missingInV5 = filteredEntitiesImun
    .filter((e) => !usedImun.has(e.id))
    .map((e) => ({
      id: e.id,
      name: e.name,
      id_satu_sehat: e.mapping_id_satu_sehat,
      type: e.type,
      province_id: e.province_id,
      regency_id: e.regency_id,
      reason: "Not found in V5 database",
    }))

  // Cari yang missing di Imun (entities V5 yang tidak ditemukan di Imun)
  const missingInImun = allV5Entities
    .filter((e) => !usedV5.has(e.id))
    .map((e) => ({
      id: e.id,
      name: e.name,
      id_satu_sehat: e.id_satu_sehat,
      type: e.type,
      province_id: e.province_id,
      regency_id: e.regency_id,
      reason: "Not found in Imun database",
    }))

  // Insert missing Imun entities ke V5
  for (const missingEntity of missingInV5) {
    const imunEntity = filteredEntitiesImun.find(
      (e) => e.id === missingEntity.id
    )
    if (imunEntity) {
      const newV5Id = await insertImunEntityToV5(imunEntity)
      if (newV5Id) {
        // Update mapping_entities jika ada id_satu_sehat
        if (imunEntity.mapping_id_satu_sehat) {
          try {
            // Gunakan transaction untuk insert mapping_entities
            await db.transaction().execute(async () => {
              await migrationDB
                .insertInto("mapping_entities")
                .values({
                  id_entitas_smile: imunEntity.id,
                  id_satu_sehat: imunEntity.mapping_id_satu_sehat,
                  created_at: new Date(),
                  updated_at: new Date(),
                })
                .execute()
            })
          } catch (error) {
            console.error(
              `❌ Failed to update mapping_entities for Imun ID ${imunEntity.id}:`,
              error
            )
          }
        }
      }
    }
  }

  // Analisis detail untuk missing entities
  const missingAnalysis = {
    missingInV5ByType: analyzeMissingByType(missingInV5),
    missingInImunByType: analyzeMissingByType(missingInImun),
    missingInV5WithoutIdSatuSehat: missingInV5.filter(
      (e) => e.id_satu_sehat === null
    ).length,
    missingInImunWithoutIdSatuSehat: missingInImun.filter(
      (e) => e.id_satu_sehat === null
    ).length,
    totalMissing: missingInV5.length + missingInImun.length,
  }

  // Buat hasil dengan analisis detail
  const result = {
    timestamp,
    totals: {
      imun: filteredEntitiesImun.length,
      v5: allV5Entities.length,
      matched: matchedEntities.length,
    },
    matchedEntities,
    mismatch: {
      missingInV5,
      missingInImun,
      totalMissingInV5: missingInV5.length,
      totalMissingInImun: missingInImun.length,
      analysis: missingAnalysis,
    },
    isConsistent: missingInV5.length === 0 && missingInImun.length === 0,
  }

  // Simpan ke file
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2), "utf-8")
  console.log(`📂 Comparison result saved to: ${outputPath}`)

  // Tampilkan ringkasan detail di console
  console.log(`\n📊 DETAILED ANALYSIS REPORT`)
  console.log(`✅ Matched Entities: ${matchedEntities.length}`)

  if (missingInV5.length > 0) {
    console.warn(`\n❌ ${missingInV5.length} ENTITIES MISSING IN V5.0:`)
    console.warn(`   📋 Breakdown by type:`)
    Object.entries(missingAnalysis.missingInV5ByType).forEach(
      ([type, count]) => {
        console.warn(`      → Type ${type}: ${count} entities`)
      }
    )
    console.warn(
      `   🔍 Without ID Satu Sehat: ${missingAnalysis.missingInV5WithoutIdSatuSehat}`
    )

    console.warn(`\n   📝 Details of missing entities in V5.0:`)
    missingInV5.slice(0, 10).forEach((e) => {
      console.warn(
        `      → ID: ${e.id}, Name: "${e.name}", Type: ${e.type}, IDSSH: ${e.id_satu_sehat || "null"}`
      )
    })
    if (missingInV5.length > 10) {
      console.warn(`      ... and ${missingInV5.length - 10} more entities`)
    }
  } else {
    console.log("✅ All Imun entities exist in 5.0.")
  }

  if (missingInImun.length > 0) {
    console.warn(`\n❌ ${missingInImun.length} ENTITIES MISSING IN IMUN:`)
    console.warn(`   📋 Breakdown by type:`)
    Object.entries(missingAnalysis.missingInImunByType).forEach(
      ([type, count]) => {
        console.warn(`      → Type ${type}: ${count} entities`)
      }
    )
    console.warn(
      `   🔍 Without ID Satu Sehat: ${missingAnalysis.missingInImunWithoutIdSatuSehat}`
    )

    console.warn(`\n   📝 Details of missing entities in Imun:`)
    missingInImun.slice(0, 10).forEach((e) => {
      console.warn(
        `      → ID: ${e.id}, Name: "${e.name}", Type: ${e.type}, IDSSH: ${e.id_satu_sehat || "null"}`
      )
    })
    if (missingInImun.length > 10) {
      console.warn(`      ... and ${missingInImun.length - 10} more entities`)
    }
  } else {
    console.log("✅ All 5.0 entities exist in Imun.")
  }

  // Helper function untuk menganalisis missing entities by type
  function analyzeMissingByType(
    missingEntities: Array<{ type: number | null }>
  ): Record<string, number> {
    const analysis: Record<string, number> = {}

    missingEntities.forEach((entity) => {
      const typeKey = entity.type !== null ? String(entity.type) : "unknown"
      analysis[typeKey] = (analysis[typeKey] || 0) + 1
    })

    return analysis
  }

  // Tampilkan summary konsistensi
  console.log(`\n📈 CONSISTENCY SUMMARY:`)
  console.log(
    `   Total entities checked: ${filteredEntitiesImun.length + allV5Entities.length}`
  )
  console.log(`   Matched successfully: ${matchedEntities.length}`)
  console.log(`   Missing entities: ${missingAnalysis.totalMissing}`)
  console.log(
    `   Consistency rate: ${((matchedEntities.length / (filteredEntitiesImun.length + allV5Entities.length - missingAnalysis.totalMissing)) * 100).toFixed(2)}%`
  )

  if (result.isConsistent) {
    console.log("🎉 Entity data is fully synchronized.")
  } else {
    console.error("🚨 Entity data inconsistency detected!")
  }

  const endTime = new Date()
  const durationMs = endTime.getTime() - startTime.getTime()
  const durationSec = (durationMs / 1000).toFixed(2)
  console.log(`✅ Comparison completed at: ${endTime.toLocaleString()}`)
  console.log(`⏱️  Total duration: ${durationSec} seconds`)

  // Tambahkan laporan duplikasi ke hasil akhir
  if (duplicateIdSatuSehatReport.length > 0) {
    console.log(`\n📋 DUPLICATE ID_SATU_SEHAT SUMMARY:`)
    console.log(
      `   Total duplicate id_satu_sehat found: ${duplicateIdSatuSehatReport.length}`
    )
    console.log(`   Total entities removed: ${removedDuplicateIds.size}`)
  }
  process.exit(0)
}
