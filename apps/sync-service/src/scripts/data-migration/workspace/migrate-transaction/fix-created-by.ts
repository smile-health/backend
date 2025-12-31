import { db as syncDB } from "@/common/infrastructure/database/index.js"
import { MAP_EXISTING_TO_PLATFORM } from "../../const.js"
import { db } from "../../../db.platform.js"
import { getMigrationDB } from "../../../db.migration.js"
import { Kysely, Transaction, sql } from "kysely"
import { DB } from "../../../types.platform.js"
import { MigrationDB } from "../../../types.js"
import { collect } from "@smile/lib/utils.js"
import { getMapUserIds, getMapTransactionIds } from "../../../helper.js"

export const fixCreatedByRaw = async (
  batchSize: number,
  existingProgramId = 2
) => {
  const startTime = new Date()
  console.log(
    `Raw SQL Migration disposal transaction started at: ${startTime.toLocaleString()}`
  )

  const platformProgramIds = MAP_EXISTING_TO_PLATFORM[existingProgramId] ?? []

  for (const platformProgramId of platformProgramIds) {
    let offset = 0
    
    while (true) {
      // Get the migration database name based on program ID
      const migrationDBName = existingProgramId === 2 ? process.env.LOGISTIK_DB_NAME : process.env.IMUN_DB_NAME
      
      const result = await db.executeQuery(
        sql`
          UPDATE ${sql.raw(process.env.PLATFORM_DB_NAME!)}.ws_transactions wt
          INNER JOIN ${sql.raw(process.env.DB_NAME!)}.mapping_transactions tm ON wt.id = tm.platform_transaction_id
          INNER JOIN ${sql.raw(migrationDBName!)}.transactions t ON tm.existing_transaction_id = t.id
          LEFT JOIN ${sql.raw(process.env.DB_NAME!)}.mapping_users um_created ON t.created_by = um_created.existing_user_id AND um_created.program_id = ${platformProgramId}
          LEFT JOIN ${sql.raw(process.env.DB_NAME!)}.mapping_users um_updated ON t.updated_by = um_updated.existing_user_id AND um_updated.program_id = ${platformProgramId}
          SET 
            wt.created_by = COALESCE(um_created.platform_user_id, 0),
            wt.updated_by = COALESCE(um_updated.platform_user_id, 0)
          WHERE tm.program_id = ${platformProgramId}
            AND tm.id IN (
              SELECT id FROM (
                SELECT id 
                FROM ${sql.raw(process.env.DB_NAME!)}.mapping_transactions 
                WHERE program_id = ${platformProgramId}
                ORDER BY id
                LIMIT ${batchSize} OFFSET ${offset}
              ) AS subquery
            )
        `.compile(db)
      )
      
      const updatedCount = result.numAffectedRows || 0
      
      if (updatedCount === 0) {
        break
      }
      
      console.log(`Processed batch with ${updatedCount} records`)
      offset += batchSize
    }
  }
}

export const fixCreatedBy = async (
  batchSize: number,
  existingProgramId = 2
) => {
  const startTime = new Date()
  console.log(
    `Migration disposal transaction started at: ${startTime.toLocaleString()}`
  )

  const platformProgramIds = MAP_EXISTING_TO_PLATFORM[existingProgramId] ?? []

  const migrationDB = getMigrationDB(existingProgramId)

  for (const platformProgramId of platformProgramIds) {
    let page = 0
    while (true) {
      const rows = await syncDB
        .selectFrom("mapping_transactions")
        .select("existing_transaction_id")
        .where("program_id", "=", platformProgramId)
        .orderBy("id")
        .limit(batchSize)
        .offset(page * batchSize)
        .execute()

      if (rows.length === 0) {
        break
      }

      const ids = collect(rows, "existing_transaction_id")

      await db.transaction().execute(async (trx) => {
        doMigrate(trx, migrationDB, existingProgramId, platformProgramId, ids)
      })

      page++
      console.log(`Processed batch ${page} with ${rows.length} records`)
    }
  }
}

async function doMigrate(
  trx: Transaction<DB>,
  migrationDB: Kysely<MigrationDB>,
  existingProgramId: number,
  platformProgramId: number,
  ids: number[]
) {
  const transactions = await migrationDB
    .selectFrom("transactions")
    .select(["id", "created_by", "updated_by"])
    .where("id", "in", ids)
    .execute()

  const [mapCreatedByIds, mapUpdatedByIds, mapTransactionIds] =
    await Promise.all([
      getMapUserIds(platformProgramId, collect(transactions, "created_by")),
      getMapUserIds(platformProgramId, collect(transactions, "updated_by")),
      getMapTransactionIds(platformProgramId, collect(transactions, "id")),
    ])

  for (const item of transactions) {
    const query = trx
      .updateTable("ws_transactions")
      .set({
        created_by: mapCreatedByIds[item.created_by ?? 0] ?? 0,
        updated_by: mapUpdatedByIds[item.created_by ?? 0] ?? 0,
      })
      .where("id", "=", mapTransactionIds[item.id ?? 0] ?? 0)
      .compile()

  }
}
