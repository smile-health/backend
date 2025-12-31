import type { Kysely } from 'kysely'
import { Database } from '../types/index.js';

export async function seed(db: Kysely<Database>): Promise<void> {
	const tableName = 'symptoms'

	const symptoms = [
		{ id: 1, name: 'Fever (temperature > 37.5°C)' },
		{ id: 2, name: 'Headache' },
		{ id: 3, name: 'Nausea' },
		{ id: 4, name: 'Vomiting' },
		{ id: 5, name: 'Rash' },
		{ id: 6, name: 'Pain and/or swelling at the injection site' },
		{ id: 7, name: 'Other complaints' },
	]

	for (const symptom of symptoms) {
		await db
			.insertInto(tableName)
			.values(symptom)
			.onDuplicateKeyUpdate({
				name: symptom.name,
			})
			.execute()
	}
}
