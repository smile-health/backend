import { Kysely } from "kysely"
import { Database } from "../types/index.js"

const mapTableIndexes = {
  ws_transactions: {
    activity_id: ["activity_id"],
    transaction_type_id: ["transaction_type_id"],
    transaction_reason_id: ["transaction_reason_id"],
    entity_id: ["entity_id"],
    companion_entity_id: ["companion_entity_id"],
    stock_id: ["stock_id"],
    order_id: ["order_id"],
    created_at: ["created_at"],
  },
}

export async function up(db: Kysely<Database>): Promise<void> {
  Object.keys(mapTableIndexes).forEach(async (table) => {
    Object.keys(mapTableIndexes[table]).forEach(async (index) => {
      await db.schema
        .createIndex(`${table}_${index}`)
        .on(table)
        .columns(mapTableIndexes[table][index])
        .execute()
    })
  })
}

export async function down(db: Kysely<Database>): Promise<void> {
  Object.keys(mapTableIndexes).forEach(async (table) => {
    Object.keys(mapTableIndexes[table]).forEach(async (index) => {
      await db.schema.dropIndex(`${table}_${index}`).on(table).execute()
    })
  })
}
