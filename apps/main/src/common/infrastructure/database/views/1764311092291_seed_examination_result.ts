import type { Kysely } from 'kysely'
import { Database } from '../types/index.js'

export async function seed(db: Kysely<Database>): Promise<void> {
	const tableName = 'examination_result'

	const examinationResults = [
		{ id: 1, name: 'Tidak diperiksa' },
		{ id: 2, name: 'IgG / IgM Salah satu atau keduanya Positif' },
		{ id: 3, name: 'IgG dan IgM Negatif' },
		{ id: 4, name: 'NS1 (-)' },
		{ id: 5, name: 'NS1 (+)' },
		{ id: 6, name: 'PCR (+)' },
		{ id: 7, name: 'NS1 (-), IgG / IgM Salah satu atau keduanya Positif' },
		{ id: 8, name: 'NS1 (+), IgG dan IgM Negatif' },
	]

	for (const result of examinationResults) {
		await db
			.insertInto(tableName)
			.values(result)
			.onDuplicateKeyUpdate({
				name: result.name,
			})
			.execute()
	}
}
