import { Kysely } from "kysely"
import { Database } from "../types/index.js"

const mapTableIndexes = {
  entities: {
    entity_tag_id: ["entity_tag_id"],
    entity_province_id: ["province_id"],
    entity_regency_id: ["regency_id"],
    entity_sub_district_id: ["sub_district_id"],
    entity_village_id: ["village_id"],
    entity_deleted_at: ["deleted_at"],
  },
  ws_customer_vendor_activities: {
    customer_vendor_id: ["customer_vendor_id"],
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
