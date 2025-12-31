import { db } from "@/common/infrastructure/database/index.js"
import { collect } from "@smile/lib/utils.js"
import { Kysely, sql, Transaction } from "kysely"
import { getMapActivityIds, getMapMaterialIds } from "../../../helper.js"
import { MigrationDB } from "../../../types.js"
import { DB } from "../../../types.platform.js"
import { MAP_EXISTING_ACTIVITY_IDS } from "../../const.js"

const formatDuration = (startTime: Date, endTime: Date): string => {
  const durationMs = endTime.getTime() - startTime.getTime()
  const hours = Math.floor(durationMs / (1000 * 60 * 60))
  const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60))
  const seconds = Math.floor((durationMs % (1000 * 60)) / 1000)
  return `${hours}h ${minutes}m ${seconds}s`
}

export const migrateEntityMaterialActivities = async (
  trx: Transaction<DB>,
  migrationDB: Kysely<MigrationDB>,
  programId: number,
  entityIds: number[],
  mapGlobalIds = {}
) => {
  const startTime = new Date()
  console.log(
    `Migration entity material activities started at: ${startTime.toLocaleString()}`
  )
  const defaultActivity = await trx
    .selectFrom("ws_activities")
    .select("id")
    .where("program_id", "=", programId)
    .executeTakeFirstOrThrow()

  const activityIds = MAP_EXISTING_ACTIVITY_IDS[programId]
  if (activityIds?.length === 0) {
    return
  }

  // migrating activities
  console.log("get old ema")
  const emas = await migrationDB
    .selectFrom("entity_has_master_materials as em")
    .innerJoin(
      "entity_master_material_activities as ema",
      "ema.entity_master_material_id",
      "em.id"
    )
    .innerJoin("master_materials as m", "m.id", "em.master_material_id")
    .select([
      "ema.id",
      "em.id as em_id",
      "em.entity_id",
      "m.parent_id as master_material_id",
      "ema.activity_id",
      sql<number>`MAX(ema.min)`.as("min"),
      sql<number>`MAX(ema.max)`.as("max"),
      sql<number>`MAX(ema.consumption_rate)`.as("consumption_rate"),
      sql<number>`MAX(ema.retailer_price)`.as("retailer_price"),
      sql<number>`MAX(ema.tax)`.as("tax"),
    ])
    .where("em.entity_id", "in", entityIds)
    .where("m.parent_id", "is not", null)
    .where("ema.activity_id", "in", activityIds ?? [-1])
    .groupBy(["em.entity_id", "m.parent_id", "ema.activity_id"])
    .execute()

  console.log("done get old ema")

  if (emas.length === 0) {
    return
  }

  // Execute mapping queries sequentially to avoid transaction deadlocks
  const mapMaterialIds = await getMapMaterialIds(
    programId,
    collect(emas, "master_material_id")
  )
  const mapActivityIds = await getMapActivityIds(
    programId,
    collect(emas, "activity_id")
  )

  const emasFiltered = emas.filter(
    (ema) => mapMaterialIds[ema.master_material_id ?? 0] !== undefined
  )
  if (emasFiltered.length === 0) {
    console.log("no ema to migrate")
    return
  }

  console.log("insert ema")
  const res = await trx
    .insertInto("ws_entity_material_activities")
    .values(
      emasFiltered.map((ema) => ({
        entity_id: mapGlobalIds[ema.entity_id ?? 0] ?? 0,
        material_id: mapMaterialIds[ema.master_material_id ?? 0] ?? 0,
        activity_id: mapActivityIds[ema.activity_id ?? 0] ?? defaultActivity.id,
        min: ema.min,
        max: ema.max,
        consumption_rate: ema.consumption_rate,
        retailer_price: ema.retailer_price,
        tax: ema.tax,
      }))
    )
    .executeTakeFirst()

  const insertedIds = Array.from(
    { length: emasFiltered.length }, // Use filtered length, not original emas.length
    (_, i) => Number(res.insertId) + i
  )
  console.log("done insert ema")

  interface MappingRow {
    program_id: number
    existing_entity_material_activity_id: number
    existing_entity_material_id: number
    platform_entity_material_activity_id: number
  }

  const wsRows: MappingRow[] = emasFiltered.map((ema, i) => ({
    program_id: programId,
    existing_entity_material_activity_id: Number(ema.id),
    existing_entity_material_id: Number(ema.em_id),
    platform_entity_material_activity_id: Number(insertedIds[i]),
  }))

  console.log("insert mapping ema")
  await db
    .insertInto("mapping_entity_material_activities")
    .values(wsRows)
    .execute()
  console.log("done insert mapping ema")

  const endTime = new Date()
  console.log(
    `Migration entity material activities completed at: ${endTime.toLocaleString()}`
  )
  console.log(`Total duration: ${formatDuration(startTime, endTime)}`)
}
