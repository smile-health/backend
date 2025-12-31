import type { Kysely } from 'kysely'
import { Database } from '../types/index.js';

export async function seed(db: Kysely<Database>): Promise<void> {
	const tableName = "last_status"

	const lastStatus = [
		{ id: 1, name: "Sembuh" },
		{ id: 2, name: "Gejala Sisa" },
		{ id: 3, name: "Meninggal" },
	]

	for (const status of lastStatus) {
		await db
			.insertInto(tableName)
			.values(status)
			.onDuplicateKeyUpdate({
				name: status.name,
			})
			.execute()
	}
}
