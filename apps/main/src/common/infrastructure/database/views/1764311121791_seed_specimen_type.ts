import type { Kysely } from 'kysely'
import { Database } from '../types/index.js'

export async function seed(db: Kysely<Database>): Promise<void> {
	const tableName = 'specimen_type'

	const specimenTypes = [
		{ id: 1, name: 'Whole Blood' },
		{ id: 2, name: 'Serum' },
		{ id: 3, name: 'Plasma' },
	]

	for (const type of specimenTypes) {
		await db
			.insertInto(tableName)
			.values(type)
			.onDuplicateKeyUpdate({
				name: type.name,
			})
			.execute()
	}
}
