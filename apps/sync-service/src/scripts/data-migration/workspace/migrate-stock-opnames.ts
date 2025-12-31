import { collect, getUniqueIdsFromFields } from "@smile/lib/utils.js"
import { Kysely, sql, Transaction } from "kysely"
import { getMigrationDB } from "../../db.migration.js"
import { db } from "../../db.platform.js"
import {
  deleteTableMapping,
  getMapActivityIds,
  getMapBatchIds,
  getMapEntityIds,
  getMapMaterialIds,
  getMapStockIds,
  getMapUserIds,
  insertTableMapping,
  resetIncrement,
} from "../../helper.js"
import { MigrationDB } from "../../types.js"
import { DB } from "../../types.platform.js"
import {
  MAP_EXISTING_ACTIVITY_IDS,
  MAP_EXISTING_TO_PLATFORM,
} from "../const.js"
import { IMMUNIZATION } from "../constants/program.js"

const formatDuration = (startTime: Date, endTime: Date): string => {
  const durationMs = endTime.getTime() - startTime.getTime()
  const hours = Math.floor(durationMs / (1000 * 60 * 60))
  const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60))
  const seconds = Math.floor((durationMs % (1000 * 60)) / 1000)
  return `${hours}h ${minutes}m ${seconds}s`
}

export const migrateStockOpnames = async (
  batchSize: number,
  existingProgramId = 1,
  truncate = false
) => {
  const startTime = new Date()
  console.log(
    `Migration stock opnames started at: ${startTime.toLocaleString()}`
  )
  console.info("Stock Opname migration starting...")

  const migrationDB = getMigrationDB(existingProgramId)
  const platformProgramIds = MAP_EXISTING_TO_PLATFORM[existingProgramId] ?? []

  if (truncate && existingProgramId === IMMUNIZATION) {
    console.log("Truncating immunization stock opname tables...")
    await deleteStockOpnameRelations(existingProgramId)
  }

  const existingPeriods = await migrationDB
    .selectFrom("opname_period as op")
    .selectAll()
    .where("op.deleted_at", "is", null)
    .execute()

  // Get unique user IDs from periods for mapping
  const periodUserIds = getUniqueIdsFromFields(
    existingPeriods,
    "created_by",
    "updated_by"
  )

  for (const platformProgramId of platformProgramIds) {
    console.log(
      `Migrating stock opnames for existing program ID ${existingProgramId} to platform program ID ${platformProgramId}`
    )

    // Get user mappings for periods
    const mapPeriodUserIds = await getMapUserIds(
      platformProgramId,
      periodUserIds
    )

    // Insert opname periods
    const newPeriodIdsMap = new Map<number, number>()
    if (existingPeriods.length > 0) {
      const periodsToInsert = existingPeriods.map((period) => ({
        program_id: platformProgramId,
        start_date: period.start_date,
        end_date: period.end_date,
        month_period: period.month_periode,
        year_period: period.year_periode,
        status: period.status,
        created_at: period.created_at ?? new Date(),
        updated_at: period.updated_at ?? new Date(),
        created_by: mapPeriodUserIds[period.created_by ?? 0] ?? 0,
        updated_by: mapPeriodUserIds[period.updated_by ?? 0] ?? 0,
      }))

      const res = await db
        .insertInto("ws_stock_opname_periods")
        .values(periodsToInsert)
        .executeTakeFirst()

      const insertedIds = Array.from(
        { length: periodsToInsert.length },
        (_, i) => Number(res.insertId) + i
      )

      existingPeriods.forEach((period, index) => {
        const newId = insertedIds[index]
        if (newId !== undefined) {
          newPeriodIdsMap.set(period.id, newId)
        }
      })

      // Insert period mappings
      const periodMappings = Object.fromEntries(newPeriodIdsMap)
      await insertTableMapping(
        "stock_opname_periods",
        platformProgramId,
        periodMappings
      )
    }

    let page = 0
    while (true) {
      const rows = await migrationDB
        .selectFrom("new_opnames as no")
        .select(["no.id"])
        .where("no.deleted_at", "is", null)
        .orderBy("no.id")
        .limit(batchSize)
        .offset(page * batchSize)
        .execute()

      if (rows.length === 0) {
        break
      }
      const opnameIds = collect(rows, "id")

      await db.transaction().execute(async (trx) => {
        await doMigrateStockOpnames(
          trx,
          migrationDB,
          existingProgramId,
          platformProgramId,
          opnameIds,
          newPeriodIdsMap
        )
      })

      page++
      console.log(`Processed batch ${page} with ${rows.length} records`)
    }
  }

  const endTime = new Date()
  console.log(
    `Migration stock opnames completed at: ${endTime.toLocaleString()}`
  )
  console.log(`Total duration: ${formatDuration(startTime, endTime)}`)
  console.log("Stock Opname migration completed")
  process.exit(0)
}

export const deleteStockOpnameRelations = async (programId = IMMUNIZATION) => {
  const platformProgramIds = MAP_EXISTING_TO_PLATFORM[programId] ?? []
  const idsSql = sql.join(
    platformProgramIds.map((id) => sql`${id}`),
    sql`, `
  )

  await Promise.all([
    sql`
      DELETE so
      FROM ws_activities a
      LEFT JOIN ws_stock_opnames so ON so.activity_id = a.id
      WHERE a.program_id IN (${idsSql})
    `.execute(db),
    db
      .deleteFrom("ws_stock_opname_periods")
      .where("program_id", "in", platformProgramIds)
      .execute(),
  ])

  // Reset auto increment for deleted tables
  await resetIncrement(db, "ws_stock_opname_periods")
  await resetIncrement(db, "ws_stock_opnames")
  await deleteTableMapping("stock_opnames", platformProgramIds)
  await deleteTableMapping("stock_opname_periods", platformProgramIds)
}

export const doMigrateStockOpnames = async (
  trx: Transaction<DB>,
  migrationDB: Kysely<MigrationDB>,
  existingProgramId: number,
  platformProgramId: number,
  opnameIds: number[],
  newPeriodIdsMap: Map<number, number>
) => {
  const activityIds = MAP_EXISTING_ACTIVITY_IDS[platformProgramId]
  if (activityIds?.length === 0) {
    return
  }

  // Get all data in one joined query
  const opnameData = await migrationDB
    .selectFrom("new_opnames as no")
    .innerJoin("new_opname_items as noi", "noi.new_opname_id", "no.id")
    .innerJoin("new_opname_stocks as nos", "nos.new_opname_item_id", "noi.id")
    .leftJoin("master_materials as mm", "mm.id", "noi.master_material_id")
    .select([
      "no.id as opname_id",
      "no.entity_id",
      "no.activity_id",
      "no.period_id",
      "no.status",
      "no.created_at",
      "no.updated_at",
      "no.created_by",
      "no.updated_by",
      "noi.id as item_id",
      "noi.master_material_id",
      "mm.parent_id",
      "nos.id as opname_stock_id",
      "nos.batch_id",
      "nos.batch_code",
      "nos.expired_date",
      "nos.real_qty",
      "nos.smile_qty",
      "nos.stock_id",
      sql`GREATEST(nos.unsubmit_distribution_qty, nos.unsubmit_return_qty)`.as(
        "in_transit_qty"
      ),
    ])
    .where("no.deleted_at", "is", null)
    .where("noi.deleted_at", "is", null)
    .where("nos.deleted_at", "is", null)
    .where("no.id", "in", opnameIds)
    .where("no.activity_id", "in", activityIds ?? [-1])
    .execute()

  if (opnameData.length === 0) return

  const [
    mapEntityIds,
    mapActivityIds,
    mapMaterialIds,
    mapStockIds,
    mapUserIds,
    mapBatchIds,
  ] = await Promise.all([
    getMapEntityIds(platformProgramId, collect(opnameData, "entity_id")),
    getMapActivityIds(platformProgramId, collect(opnameData, "activity_id")),
    getMapMaterialIds(
      platformProgramId,
      getUniqueIdsFromFields(opnameData, "master_material_id", "parent_id")
    ),
    getMapStockIds(platformProgramId, collect(opnameData, "stock_id")),
    getMapUserIds(
      platformProgramId,
      getUniqueIdsFromFields(opnameData, "created_by", "updated_by")
    ),
    getMapBatchIds(platformProgramId, collect(opnameData, "batch_id")),
  ])

  // Get production_date and manufacture_id from mapped batch IDs
  const mappedBatchIds = Object.values(mapBatchIds).filter((id) => id > 0)
  const batchInfo =
    mappedBatchIds.length > 0
      ? await trx
          .selectFrom("ws_batches")
          .select(["id", "production_date", "manufacture_id"])
          .where("id", "in", mappedBatchIds)
          .execute()
          .then((rows) =>
            rows.reduce(
              (acc, row) => ({
                ...acc,
                [row.id]: {
                  production_date: row.production_date,
                  manufacture_id: row.manufacture_id,
                },
              }),
              {} as Record<
                number,
                { production_date: Date | null; manufacture_id: number | null }
              >
            )
          )
      : {}

  // Bulk insert - using correct table name from DB type
  const insertResult = await trx
    .insertInto("ws_stock_opnames")
    .values(
      opnameData.map((data) => ({
        entity_id: mapEntityIds[data.entity_id] ?? 0,
        activity_id: mapActivityIds[data.activity_id ?? 0] ?? 0,
        period_id: newPeriodIdsMap.get(data.period_id ?? 0) ?? 0,
        material_id: mapMaterialIds[data.master_material_id ?? 0] ?? 0,
        parent_material_id: mapMaterialIds[data.parent_id ?? 0] ?? null,
        stock_id: mapStockIds[data.stock_id ?? 0] ?? 0,
        batch_code: data.batch_code ?? "",
        expired_date: data.expired_date ?? null,
        production_date:
          batchInfo[mapBatchIds[data.batch_id ?? 0]]?.production_date ?? null,
        manufacture_id:
          batchInfo[mapBatchIds[data.batch_id ?? 0]]?.manufacture_id ?? null,
        recorded_qty: data.smile_qty ?? 0,
        actual_qty: data.real_qty ?? 0,
        in_transit_qty: Number(data.in_transit_qty),
        is_within_period: data.status ?? 0,
        created_at: data.created_at ?? new Date(),
        updated_at: data.updated_at ?? new Date(),
        created_by: mapUserIds[data.created_by ?? 0] ?? 0,
        updated_by: mapUserIds[data.updated_by ?? 0] ?? 0,
      }))
    )
    .onDuplicateKeyUpdate({
      recorded_qty: sql`values(recorded_qty)`,
      actual_qty: sql`values(actual_qty)`,
      in_transit_qty: sql`values(in_transit_qty)`,
      updated_at: sql`values(updated_at)`,
    })
    .execute()

  // Insert stock opname mappings
  // Note: We're merging multiple tables (new_opnames, new_opname_items, new_opname_stocks)
  // into a single ws_stock_opnames table, so we map each stock record (nos.id) to the new record

  const result = Array.isArray(insertResult) ? insertResult[0] : insertResult
  if (result.insertId && opnameData.length > 0) {
    const stockOpnameMappings: Record<number, number> = {}
    const startId = Number(result.insertId)
    const insertedIds = Array.from(
      { length: opnameData.length },
      (_, i) => startId + i
    )

    opnameData.forEach((data, index) => {
      const newId = insertedIds[index]
      if (newId !== undefined) {
        // Map the nos.id (new_opname_stocks.id) to the new ws_stock_opnames record
        stockOpnameMappings[data.opname_stock_id] = newId
      }
    })

    console.log(
      `Inserting ${Object.keys(stockOpnameMappings).length} stock opname mappings for program ${platformProgramId}`
    )

    if (Object.keys(stockOpnameMappings).length > 0) {
      await insertTableMapping(
        "stock_opnames",
        platformProgramId,
        stockOpnameMappings
      )
    }
  }
}
