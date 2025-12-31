import { Kysely } from 'kysely'
import { Database } from '../types/index.js'

export async function seed(db: Kysely<Database>): Promise<void> {
	const tableName = 'workspaces'

	const workspaces = [
		{
			id: 225,
			key: 'dengue_beneficiaries',
			name: 'DENGUE',
			config: '{"material": {"is_hierarchy_enabled": true, "is_batch_enabled": false}, "color": "#9d174d"}',
			created_at: new Date('2025-12-06 13:23:49'),
			updated_at: new Date(),
			program_uuid: 'fb260f9b-f13a-41d9-9847-cfdc180b0de3',
			description: 'Dengue Beneficiaries',
			is_beneficiaries: 1,
		},
		{
			id: 224,
			key: 'immunization_beneficiaries',
			name: 'IMUNISASI',
			config: '{"material": {"is_hierarchy_enabled": true, "is_batch_enabled": false}, "color": "#004990"}',
			created_at: new Date('2025-12-04 02:53:56'),
			updated_at: new Date(),
			program_uuid: 'aeca82ca-7253-4e76-8492-0ca2430426c2',
			description: 'Immunization Beneficiaries',
			is_beneficiaries: 1,
		},
	]

	for (const workspace of workspaces) {
		await db
			.insertInto(tableName)
			.values(workspace)
			.onDuplicateKeyUpdate({
				key: workspace.key,
				name: workspace.name,
				config: workspace.config,
				updated_at: workspace.updated_at,
				program_uuid: workspace.program_uuid,
				description: workspace.description,
				is_beneficiaries: workspace.is_beneficiaries,
			})
			.execute()
	}
}
