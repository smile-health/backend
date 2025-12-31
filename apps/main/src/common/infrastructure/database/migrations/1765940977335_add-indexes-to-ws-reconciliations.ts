import { Kysely } from "kysely"
import { Database } from "../types/index.js"

const mapTableIndexes = {
  ws_reconciliations: {
    material_id: ["material_id"],
    entity_id: ["entity_id"],
    start_date: ["start_date"],
    end_date: ["end_date"],
    created_at: ["created_at"],
    program_id: ["program_id"],
  },
}

export async function up(db: Kysely<Database>): Promise<void> {
  for (const table of Object.keys(mapTableIndexes)) {
    for (const indexName of Object.keys(mapTableIndexes[table])) {
      await db.schema
        .createIndex(`${table}_${indexName}`)
        .on(table)
        .columns(mapTableIndexes[table][indexName])
        .execute()
    }
  }
}

export async function down(db: Kysely<Database>): Promise<void> {
  for (const table of Object.keys(mapTableIndexes)) {
    for (const indexName of Object.keys(mapTableIndexes[table])) {
      await db.schema.dropIndex(`${table}_${indexName}`).on(table).execute()
    }
  }
}
