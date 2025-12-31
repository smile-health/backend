import type { Kysely } from 'kysely'
import { Database } from '../types/index.js';

export async function seed(db: Kysely<Database>): Promise<void> {
	const tableName = "vector_control"

	const vectorControls = [
		{ id: 1, name: "Penyuluhan" },
		{ id: 2, name: "PSN 3M Plus" },
		{ id: 3, name: "Larvasida" },
		{ id: 4, name: "Fogging" },
	]

	for (const control of vectorControls) {
		await db
			.insertInto(tableName)
			.values(control)
			.onDuplicateKeyUpdate({
				name: control.name,
			})
			.execute()
	}
}
