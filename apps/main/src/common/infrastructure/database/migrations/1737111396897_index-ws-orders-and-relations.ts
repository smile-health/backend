import { Kysely } from "kysely"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .createIndex("ws_order_audits_order_id_index")
    .on("ws_order_audits")
    .column("order_id")
    .execute()

  await db.schema
    .createIndex("ws_order_histories_order_id_index")
    .on("ws_order_histories")
    .column("order_id")
    .execute()

  await db.schema
    .createIndex("ws_order_comments_order_id_index")
    .on("ws_order_comments")
    .column("order_id")
    .execute()

  await db.schema
    .createIndex("ws_order_item_stocks_order_id_index")
    .on("ws_order_item_stocks")
    .column("order_id")
    .execute()

  await db.schema
    .createIndex("ws_order_item_projection_capacities_order_id_index")
    .on("ws_order_item_projection_capacities")
    .column("order_id")
    .execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await Promise.allSettled([
    db.schema.dropIndex("ws_order_audits_order_id_index").execute(),
    db.schema.dropIndex("ws_order_histories_order_id_index").execute(),
    db.schema.dropIndex("ws_order_comments_order_id_index").execute(),
    db.schema.dropIndex("ws_order_item_stocks_order_id_index").execute(),
    db.schema
      .dropIndex("ws_order_item_projection_capacities_order_id_index")
      .execute(),
  ])
}
