/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Kysely } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
	// Drop the existing month_year_unique_index constraint
	await db.schema
		.alterTable('ws_stock_opname_periods')
		.dropConstraint('month_year_unique_index')
		.execute()

	// Add new unique constraint that includes deleted_at
	await db.schema
		.alterTable('ws_stock_opname_periods')
		.addUniqueConstraint('month_year_unique_index', [
			'program_id',
			'month_period', 
			'year_period',
			'deleted_at'
		])
		.execute()
}

export async function down(db: Kysely<any>): Promise<void> {
	// Drop the new constraint
	await db.schema
		.alterTable('ws_stock_opname_periods')
		.dropConstraint('month_year_unique_index')
		.execute()

	// Restore the original constraint without deleted_at
	await db.schema
		.alterTable('ws_stock_opname_periods')
		.addUniqueConstraint('month_year_unique_index', [
			'program_id',
			'month_period',
			'year_period'
		])
		.execute()
}
