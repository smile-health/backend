import { Kysely } from "kysely"
import { Database } from "../types/index.js"

const mapTableIndexes = {
	"ws_entity_material_activities": {
		"ema_id": ["entity_id", "material_id", "activity_id"],
		"entity_id": ["entity_id"],
	},
	"ws_entity_activities": {
		"ea_id": ["entity_id", "activity_id"],
		"entity_id": ["entity_id"],
	},
	"ws_customer_vendors": {
		"cv_id": ["customer_id", "vendor_id"],
		"customer_id": ["customer_id"],
		"vendor_id": ["vendor_id"],
	}
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
