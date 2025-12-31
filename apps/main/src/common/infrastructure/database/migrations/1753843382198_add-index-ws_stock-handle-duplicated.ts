import { type Kysely } from "kysely"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  // await db
  //   .updateTable("ws_stocks as stock")
  //   .set({ batch_code: sql`batch.code` })
  //   .from("ws_batches as batch")
  //   .whereRef("stock.batch_id", "=", "batch.id")
  //   .execute()

  // add index for batch_code, material_id, activity_id, manufacture_id and entity_id
  // unique index to handle duplicated batch_code
  await db.schema
    .createIndex("ws_stock_idex_unique_batch_ema")
    .on("ws_stocks")
    .columns([
      "batch_code",
      "material_id",
      "activity_id",
      "entity_id",
      "manufacture_id",
    ])
    .unique()
    .execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.dropIndex("ws_stock_idex_unique_batch_ema").execute()
}
