import { db } from "../../../db.platform.js"
import { db as syncDB } from "@/common/infrastructure/database/index.js"
import { getMigrationDB } from "../../../db.migration.js"
import { collect } from "@smile/lib/utils.js"
import { CompiledQuery, Kysely, Transaction, sql } from "kysely"
import {
  getMapUserIds,
  getMapStockIds,
  getMapTransactionReasonIds,
  insertTableMapping,
  resetIncrement,
  deleteTableMapping,
} from "../../../helper.js"
import { DB } from "../../../types.platform.js"
import { MigrationDB } from "../../../types.js"

import {
  MAP_EXISTING_ACTIVITY_IDS,
  MAP_EXISTING_TO_PLATFORM,
} from "../../const.js"
import { IMMUNIZATION } from "../../constants/program.js"

const formatDuration = (startTime: Date, endTime: Date): string => {
  const durationMs = endTime.getTime() - startTime.getTime()
  const hours = Math.floor(durationMs / (1000 * 60 * 60))
  const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60))
  const seconds = Math.floor((durationMs % (1000 * 60)) / 1000)
  return `${hours}h ${minutes}m ${seconds}s`
}

export const migrateDisposalStock = async (
  batchSize: number,
  existingProgramId = 1,
  truncate = false
) => {
  const startTime = new Date()
  console.log(
    `Migration disposal stock started at: ${startTime.toLocaleString()}`
  )

  const platformProgramIds = MAP_EXISTING_TO_PLATFORM[existingProgramId] ?? []

  if (truncate && existingProgramId === IMMUNIZATION) {
    console.log("Truncating immunization disposal stock tables...")
    await deleteDisposalStockRelations(existingProgramId)
  }

  const migrationDB = getMigrationDB(existingProgramId)

  for (const platformProgramId of platformProgramIds) {
    console.log(
      `Migrating disposal stock for existing program ID ${existingProgramId} to platform program ID ${platformProgramId}`
    )

    const activityIds = MAP_EXISTING_ACTIVITY_IDS[platformProgramId]
    if (activityIds?.length === 0) {
      continue
    }

    let page = 0
    while (true) {
      const rows = await migrationDB
        .selectFrom("stock_exterminations as se")
        .innerJoin("stocks as s", "se.stock_id", "s.id")
        .select(["se.id"])
        .where("s.activity_id", "in", activityIds ?? [-1])
        .orderBy("se.id")
        .limit(batchSize)
        .offset(page * batchSize)
        .execute()

      if (rows.length === 0) {
        break
      }
      const disposalStockIds = collect(rows, "id")

      await db.transaction().execute(async (trx) => {
        await doMigrate(
          trx,
          migrationDB,
          existingProgramId,
          platformProgramId,
          disposalStockIds
        )
      })

      page++
      console.log(`Processed batch ${page} with ${rows.length} records`)
    }
  }

  const endTime = new Date()
  console.log(`Migration eventReport completed at: ${endTime.toLocaleString()}`)
  console.log(`Total duration: ${formatDuration(startTime, endTime)}`)
  process.exit(0)
}

async function doMigrate(
  trx: Transaction<DB>,
  migrationDB: Kysely<MigrationDB>,
  existingProgramId: number,
  platformProgramId: number,
  disposalStockIds: number[]
) {
  //get all data in joined query
  const disposalStocks = await migrationDB
    .selectFrom("stock_exterminations as se")
    .select([
      "se.id",
      "se.stock_id", //convert
      "se.transaction_reason_id",
      "se.extermination_discard_qty",
      "se.extermination_received_qty",
      "se.extermination_qty",
      "se.extermination_shipped_qty",
      "se.created_by", //convert
      "se.updated_by", //convert
      "se.createdAt",
      "se.updatedAt",
    ])
    .where("se.id", "in", disposalStockIds)
    .execute()

  if (disposalStocks.length === 0) {
    throw new Error("disposal stocks empty")
  }

  const [mapCreatedByIds, mapUpdatedByIds, mapStockIds, mapReasonIds] =
    await Promise.all([
      getMapUserIds(platformProgramId, collect(disposalStocks, "created_by")),
      getMapUserIds(platformProgramId, collect(disposalStocks, "updated_by")),
      getMapStockIds(platformProgramId, collect(disposalStocks, "stock_id")),
      getMapTransactionReasonIds(
        platformProgramId,
        collect(disposalStocks, "transaction_reason_id")
      ),
    ])

  const disposalMap = new Map()
  const result = await trx
    .insertInto("ws_disposal_stocks")
    .values(
      disposalStocks.map((item) => {
        const v = {
          stock_id: mapStockIds[item.stock_id ?? 0] ?? 0,
          transaction_reason_id:
            mapReasonIds[item.transaction_reason_id ?? 0] ?? 0,
          disposal_discard_qty: item.extermination_discard_qty ?? 0,
          disposal_received_qty: item.extermination_received_qty ?? 0,
          disposal_qty: item.extermination_qty ?? 0,
          disposal_shipped_qty: item.extermination_shipped_qty ?? 0,
          created_by: mapCreatedByIds[item.created_by ?? 0] ?? 0,
          updated_by: mapUpdatedByIds[item.created_by ?? 0] ?? 0,
          created_at: item.createdAt ?? new Date(),
          updated_at: item.updatedAt ?? new Date(),
        }
        disposalMap.set(item.id, v)

        return v
      })
    )
    .executeTakeFirst()

  const disposalNewIds = Array.from(
    { length: disposalStocks.length },
    (_, i) => Number(result.insertId) + i
  )

  const mapGlobalIds = {}

  let index = 0
  for (const [oldId] of disposalMap) {
    mapGlobalIds[oldId] = disposalNewIds[index]
    index++
  }

  await insertTableMapping(
    "stock_exterminations",
    platformProgramId,
    mapGlobalIds
  )

  await trx.executeQuery(
    CompiledQuery.raw(`
      DROP TEMPORARY TABLE IF EXISTS temp_valid_ids
    `)
  )

  // await trx.executeQuery(
  //   CompiledQuery.raw(`
  //     CREATE TEMPORARY TABLE temp_valid_ids AS
  //     SELECT a.id
  //     FROM ws_disposal_stocks a
  //     JOIN ws_stocks b ON a.stock_id = b.id
  //   `)
  // )

  // await trx.executeQuery(
  //   CompiledQuery.raw(`
  //     DELETE FROM ws_disposal_stocks
  //     WHERE id NOT IN (SELECT id FROM temp_valid_ids)
  //   `)
  // )
}

export const deleteDisposalStockRelations = async (programId = IMMUNIZATION) => {
  const platformProgramIds = MAP_EXISTING_TO_PLATFORM[programId] ?? []
  if (platformProgramIds.length === 0) {
    console.log(`No platform program IDs found for program ${programId}, skipping disposal stock deletion`)
    return
  }

  const idsSql = sql.join(
    platformProgramIds.map((id) => sql`${id}`),
    sql`, `
  )

  await sql`
    DELETE ds
    FROM ws_activities a
    LEFT JOIN ws_stocks s ON s.activity_id = a.id
    LEFT JOIN ws_disposal_stocks ds ON ds.stock_id = s.id
    WHERE a.program_id IN (${idsSql})
  `.execute(db)

  // Reset auto increment for deleted tables
  await resetIncrement(db, "ws_disposal_stocks")
  await deleteTableMapping("stock_exterminations", platformProgramIds)
}
