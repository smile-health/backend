import type { Kysely } from 'kysely'
import { Database } from '../types/index.js';

export async function seed(db: Kysely<Database>): Promise<void> {
	const tableName = "clinical_diagnosis"

	const clinicalDiagnosis = [
		{ id: 1, name: "DD" },
		{ id: 2, name: "DBD" },
		{ id: 3, name: "DSS" },
		{ id: 4, name: "EDS" },
		{ id: 5, name: "Dengue Tanpa Warning Signs" },
		{ id: 6, name: "Dengue Dengan Warning Signs" },
		{ id: 7, name: "Severe Dengue" },
	]

	for (const clinical of clinicalDiagnosis) {
		await db
			.insertInto(tableName)
			.values(clinical)
			.onDuplicateKeyUpdate({
				name: clinical.name,
			})
			.execute()
	}
}
