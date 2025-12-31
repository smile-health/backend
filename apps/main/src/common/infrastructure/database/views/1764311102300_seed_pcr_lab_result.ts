import type { Kysely } from 'kysely'
import { Database } from '../types/index.js'

export async function seed(db: Kysely<Database>): Promise<void> {
	const tableName = 'pcr_lab_result'

	const pcrLabResult = [
		{ id: 1, name: 'Den-1' },
		{ id: 2, name: 'Den-2' },
		{ id: 3, name: 'Den-3' },
		{ id: 4, name: 'Den-4' },
		{ id: 5, name: 'Mix' },
	]

	for (const result of pcrLabResult) {
		await db
			.insertInto(tableName)
			.values(result)
			.onDuplicateKeyUpdate({
				name: result.name,
			})
			.execute()
	}
}
