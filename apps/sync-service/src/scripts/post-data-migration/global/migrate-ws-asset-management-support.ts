import { Transaction } from "kysely"
import { db } from "../../db.platform.js"
import { resetIncrement } from "../../helper.js"
import { DB } from "../../types.platform.js"

const now = new Date()

const tableNames = [
  "asset_working_statuses",
  "asset_calibration_schedules",
  "asset_maintenance_schedules",
  "asset_electricities",
]

export async function migrateWsAssetManagementSupport(
  truncate: boolean = false
) {
  console.time("⏱️ Migration start at")

  for (const tableName of tableNames) {
    if (truncate) {
      await db.deleteFrom(tableName).execute()

      await resetIncrement(db, tableName)
    }

    await db.transaction().execute(async (trx: Transaction<DB>) => {
      const wsTables = await trx
        .selectFrom(`ws_${tableName}`)
        .select(["id", "name"])
        .orderBy("id")
        .execute()

      if (wsTables.length > 0) {
        const names = wsTables
          .map((r) => r.name ?? null)
          .filter((n): n is string => n !== null)

        const globalTables = await trx
          .selectFrom(tableName)
          .select(["id", "name"])
          .where("name", "in", names)
          .orderBy("id")
          .execute()

        const existingNames = new Set(
          globalTables.map((globalTable) => globalTable.name)
        )

        const toInsert = wsTables
          .filter((wsTable) => !existingNames.has(wsTable.name))
          .map((wsTable) => ({
            id: wsTable.id,
            name: wsTable.name,
            created_at: now,
            updated_at: now,
          }))

        if (toInsert.length > 0) {
          await trx.insertInto(tableName).values(toInsert).execute()
          console.log(`Inserted ${toInsert.length} new to ${tableName}`)
        } else {
          console.log(`Inserted ${toInsert.length} new to ${tableName}`)
        }
      }
    })
  }

  console.timeEnd("⏱️ Migration end at")
}
