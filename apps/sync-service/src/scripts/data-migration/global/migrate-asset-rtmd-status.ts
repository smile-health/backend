import { Transaction } from "kysely"
import { db } from "../../db.platform.js"
import { resetIncrement } from "../../helper.js"
import { DB } from "../../types.platform.js"

const data = [
  {
    id: 1,
    name: "asset_rtmd_status.label.active",
  },
  {
    id: 2,
    name: "asset_rtmd_status.label.inactive",
  },
  {
    id: 3,
    name: "asset_rtmd_status.label.unsubscribes",
  },
]

const now = new Date()

export async function migrateAssetRtmdStatus(truncate: boolean = false) {
  console.time("⏱️ Migration start at")

  if (truncate) {
    await db.deleteFrom("asset_rtmd_statuses").execute()

    await resetIncrement(db, "asset_rtmd_statuses")
  }

  await db.transaction().execute(async (trx: Transaction<DB>) => {
    const assetRtmdStatuses = await trx
      .selectFrom("asset_rtmd_statuses")
      .select(["id", "name"])
      .execute()

    const existingNames = new Set(
      assetRtmdStatuses.map((assetRtmdStatus) => assetRtmdStatus.name)
    )

    const toInsert = data
      .filter((d) => !existingNames.has(d.name))
      .map((d) => ({
        id: d.id,
        name: d.name,
        created_at: now,
        updated_at: now,
      }))

    if (toInsert.length > 0) {
      await trx.insertInto("asset_rtmd_statuses").values(toInsert).execute()
      console.log(`Inserted ${toInsert.length} new to ${"asset_rtmd_statuses"}`)
    } else {
      console.log(`Inserted ${toInsert.length} new to ${"asset_rtmd_statuses"}`)
    }
  })

  console.timeEnd("⏱️ Migration end at")
}
