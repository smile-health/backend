import { collect } from "@smile-health/lib/utils.js"
import { Kysely, Transaction } from "kysely"
import { getMigrationDB } from "../../../db.migration.js"
import { db } from "../../../db.platform.js"
import { getMapMaterialIds } from "../../../helper.js"
import { MigrationDB } from "../../../types.js"
import { DB } from "../../../types.platform.js"

type MigrationEmonevMaterialRow = {
  id: number
  master_material_id: number | null
  tahun: number | null
  nama_xls: string | null
  type_rop: string | null
  obat_id: string | null
  uraian: string | null
  created_at?: Date
  updated_at?: Date
  createdAt?: Date
  updatedAt?: Date
}

const EMONEV_TARGET_GROUP_MAPPING: Record<number, string[]> = {
  1: ["902", "1175", "1177"],
  2: ["907", "908", "1176", "1230", "1343", "1474", "1476", "1477", "1517"],
  3: ["1350", "1351"],
  4: ["905", "1352"],
  5: ["1036"],
  6: ["1353"],
  7: ["1344"],
  8: ["1475"],
  9: ["1354"],
}

const getEmonevTargetGroupId = (obatId: string | null): number | null => {
  if (!obatId) return null

  for (const [targetGroupId, obatIds] of Object.entries(
    EMONEV_TARGET_GROUP_MAPPING
  )) {
    if (obatIds.includes(obatId)) {
      return Number(targetGroupId)
    }
  }

  return null
}

export const migrateEmonevMaterials = async (
  batchSize: number,
  programId = 1
) => {
  const startTime = new Date()
  console.info(
    `Migration Emonev Materials started at: ${startTime.toLocaleString()}`
  )

  const migrationDB = getMigrationDB(programId)

  let totalCount = 0
  let page = 0

  try {
    while (true) {
      const rows = await migrationDB
        .selectFrom("integration_emonev_materials as iem")
        .select(["iem.id"])
        .orderBy("iem.id")
        .limit(batchSize)
        .offset(page * batchSize)
        .execute()

      if (rows.length === 0) {
        break
      }

      const materialIds = collect(rows, "id")

      await db.transaction().execute(async (trx) => {
        const count = await doMigrateEmonevMaterials(
          trx,
          migrationDB,
          materialIds,
          programId
        )
        totalCount += count
      })

      page++
      console.log(
        `Emonev Materials batch ${page} completed (${rows.length} records)`
      )
    }

    console.info(
      `✅ Emonev Materials migration completed: ${totalCount} records`
    )
    return { count: totalCount }
  } catch (error) {
    console.error("❌ Emonev Materials migration failed")
    console.error(error)
    throw error
  }
}

export const doMigrateEmonevMaterials = async (
  trx: Transaction<DB>,
  migrationDB: Kysely<MigrationDB>,
  materialIds: number[],
  programId: number
) => {
  const materials = (await migrationDB
    .selectFrom("integration_emonev_materials as iem")
    .selectAll()
    .where("iem.id", "in", materialIds)
    .execute()) as unknown as MigrationEmonevMaterialRow[]

  if (materials.length === 0) {
    return 0
  }

  const masterMaterialIds = collect(materials, "master_material_id").filter(
    (id): id is number => typeof id === "number"
  )

  const mapPlatformMaterialIds = await getMapMaterialIds(
    programId,
    masterMaterialIds
  )

  const platformMaterialIds = Object.values(mapPlatformMaterialIds).filter(
    (id): id is number => id != null
  )

  const wsMaterials =
    platformMaterialIds.length > 0
      ? await trx
          .selectFrom("ws_materials")
          .select(["id", "parent_id"])
          .where("id", "in", platformMaterialIds)
          .execute()
      : []

  const mapParentIds = wsMaterials.reduce(
    (acc, row) => {
      acc[row.id] = row.parent_id
      return acc
    },
    {} as Record<number, number | null>
  )

  const insertData = materials.map((material) => ({
    id: material.id,
    material_id:
      material.master_material_id == null
        ? null
        : (mapParentIds[
            mapPlatformMaterialIds[material.master_material_id] ?? 0
          ] ?? null),
    tahun: material.tahun,
    nama_xls: material.nama_xls,
    type_rop: material.type_rop,
    obat_id: material.obat_id,
    target_group_id: getEmonevTargetGroupId(material.obat_id),
    uraian: material.uraian,
    created_at: material.created_at ?? material.createdAt,
    updated_at: material.updated_at ?? material.updatedAt,
  }))

  await trx
    .insertInto("integration_emonev_materials")
    .values(insertData)
    .onDuplicateKeyUpdate({
      material_id: (eb) => eb.ref("material_id"),
      tahun: (eb) => eb.ref("tahun"),
      nama_xls: (eb) => eb.ref("nama_xls"),
      type_rop: (eb) => eb.ref("type_rop"),
      obat_id: (eb) => eb.ref("obat_id"),
      target_group_id: (eb) => eb.ref("target_group_id"),
      uraian: (eb) => eb.ref("uraian"),
      updated_at: (eb) => eb.ref("updated_at"),
    })
    .execute()

  return materials.length
}
