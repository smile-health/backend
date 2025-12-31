import { Transaction } from "kysely"
import { db } from "../../db.platform.js"
import { resetIncrement } from "../../helper.js"
import { DB } from "../../types.platform.js"

const type = {
  name: "asset_vendor_type.label.communication_provider",
}

const now = new Date()

export async function migrateAssetVendorTypesCommunicationProvider() {
  console.time("⏱️ Migration start at")

  await resetIncrement(db, "asset_vendor_types")

  await db.transaction().execute(async (trx: Transaction<DB>) => {
    const assetVendorType = await trx
      .selectFrom("asset_vendor_types")
      .select(["id"])
      .where("name", "=", type.name)
      .executeTakeFirst()

    if (!assetVendorType) {
      await trx
        .insertInto("asset_vendor_types")
        .values({
          name: type.name,
          created_at: now,
          updated_at: now,
        })
        .execute()
    }
  })

  console.timeEnd("⏱️ Migration end at")
}
