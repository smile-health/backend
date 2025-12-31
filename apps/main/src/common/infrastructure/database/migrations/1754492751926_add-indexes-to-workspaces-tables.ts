import { Kysely } from "kysely"
import { Database } from "../types/index.js"

const mapTableIndexes = {
  user_workspaces: {
    uw_id: ["user_id", "workspace_id"],
    user_id: ["user_id"],
  },
  entity_workspaces: {
    ew_id: ["entity_id", "workspace_id"],
    entity_id: ["entity_id"],
  },
  manufacture_workspaces: {
    mw_id: ["manufacture_id", "workspace_id"],
    manufacture_id: ["manufacture_id"],
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
