import { sql, Transaction } from "kysely"
import { db } from "../../db.platform.js"
import { resetIncrement } from "../../helper.js"
import { DB } from "../../types.platform.js"

const CHUNK_SIZE = 1000

export async function migrateAssetModelsNonPqs(
  limit = CHUNK_SIZE,
  truncate = false
) {
  console.time("⏱️ Migration start at")
  let offset = 0
  let totalMigrated = 0

  if (truncate) {
    console.log("🧹 Truncating asset_models_non_temperatures_capacities...")
    await sql`TRUNCATE TABLE asset_models_non_temperatures_capacities`.execute(
      db
    )
    await resetIncrement(db, "asset_models_non_temperatures_capacities")
  }

  while (true) {
    const batchStart = Date.now()
    const now = new Date()

    const isDone = await db
      .transaction()
      .execute(async (trx: Transaction<DB>) => {
        // 1. Ambil batch asset_models dengan pqs_code_id null
        const assets = await trx
          .selectFrom("asset_models")
          .select([
            "id as asset_model_id",
            "gross_capacity",
            "net_capacity",
            "created_by",
            "updated_by",
            "deleted_by",
            "created_at",
            "updated_at",
            "deleted_at",
          ])
          .where("pqs_code_id", "is", null)
          .orderBy("id")
          .limit(limit)
          .offset(offset)
          .execute()

        if (assets.length === 0) return true

        // 2. Ambil data existing dari tabel target
        const existing = await trx
          .selectFrom("asset_models_non_temperatures_capacities")
          .select(["asset_model_id", "gross_capacity", "net_capacity"])
          .where(
            "asset_model_id",
            "in",
            assets.map((a) => a.asset_model_id)
          )
          .execute()

        const existingMap = new Map<
          number,
          { gross_capacity: any; net_capacity: any }
        >()
        for (const e of existing) {
          existingMap.set(e.asset_model_id, {
            gross_capacity: e.gross_capacity,
            net_capacity: e.net_capacity,
          })
        }

        const toInsert = []
        const toUpdate = []

        for (const asset of assets) {
          const data = {
            asset_model_id: asset.asset_model_id,
            net_capacity: asset.net_capacity,
            gross_capacity: asset.gross_capacity,
            created_by: asset.created_by,
            updated_by: asset.updated_by,
            deleted_by: asset.deleted_by,
            created_at: asset.created_at ? new Date(asset.created_at) : now,
            updated_at: asset.updated_at ? new Date(asset.updated_at) : now,
            deleted_at: asset.deleted_at ? new Date(asset.deleted_at) : null,
          }
          const existing = existingMap.get(asset.asset_model_id)
          if (!existing) {
            toInsert.push(data)
          } else if (
            existing.gross_capacity !== asset.gross_capacity ||
            existing.net_capacity !== asset.net_capacity
          ) {
            toUpdate.push(data)
          }
        }

        // 3. Insert data baru
        if (toInsert.length > 0) {
          await trx
            .insertInto("asset_models_non_temperatures_capacities")
            .values(toInsert)
            .execute()
        }

        // 4. Update yang sudah ada
        for (const row of toUpdate) {
          await trx
            .updateTable("asset_models_non_temperatures_capacities")
            .set({
              gross_capacity: row.gross_capacity,
              net_capacity: row.net_capacity,
              updated_at: row.updated_at,
              updated_by: row.updated_by,
            })
            .where("asset_model_id", "=", row.asset_model_id)
            .execute()
        }

        // Step 5: Hapus orphaned dan duplikat (sisakan 1 yang id paling kecil)
        // 1. Hapus orphaned asset_model_id
        await trx
          .deleteFrom("asset_models_non_temperatures_capacities")
          .where(({ eb }) =>
            eb(
              "asset_model_id",
              "not in",
              trx.selectFrom("asset_models").select("id")
            )
          )
          .execute()

        // 2. Hapus duplikat asset_model_id (sisakan id terkecil per group)
        const subquery = trx
          .selectFrom("asset_models_non_temperatures_capacities")
          .select((eb) => eb.fn.min("id").as("min_id"))
          .groupBy("asset_model_id")

        await trx
          .deleteFrom("asset_models_non_temperatures_capacities")
          .where("id", "not in", (eb) =>
            eb
              .selectFrom(subquery.as("t")) // ✅ derived table
              .select("t.min_id")
          )
          .execute()

        totalMigrated += assets.length
        console.log(
          `Migrated ${totalMigrated} records in ${(Date.now() - batchStart) / 1000}s`
        )

        return false // not done
      })

    if (isDone) break
    offset += limit
  }

  console.timeEnd("⏱️ Migration finish at")
}
