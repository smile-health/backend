import type { Kysely } from 'kysely'
import { Database } from '../types/index.js'

export async function seed(db: Kysely<Database>): Promise<void> {
	const tableName = 'examination_method'

	const examinationMethods = [
		{ id: 1, name: 'NS1' },
		{ id: 2, name: 'PCR' },
		{ id: 3, name: 'IgM' },
		{ id: 4, name: 'IgG' },
	]

	for (const method of examinationMethods) {
		await db
			.insertInto(tableName)
			.values(method)
			.onDuplicateKeyUpdate({
				name: method.name,
			})
			.execute()
	}
}
