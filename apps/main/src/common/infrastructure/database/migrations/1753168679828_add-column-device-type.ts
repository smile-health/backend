import type { Kysely } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  	await db.schema
    .alterTable("ws_disposal_shipments")
	.addColumn("device_type", "smallint")
    .execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable("ws_disposal_shipments").dropColumn("device_type").execute()
}
