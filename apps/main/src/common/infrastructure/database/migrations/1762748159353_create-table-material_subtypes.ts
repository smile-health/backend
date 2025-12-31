import { type Kysely } from "kysely"
import { addAuditColumns, addTimestampColumns } from "../helper.js"
import { Database } from "../types/index.js"

/**
 * 
 * @param db 
 * Table material_subtypes {
		id bigint [pk, increment]
		name text [not null]
		created_by bigint [not null]
		updated_by bigint [not null]
		deleted_by bigint
		created_at timestamp [not null, default: `current_timestamp()`]
		updated_at timestamp [not null, default: `current_timestamp()`]
		deleted_at timestamp
	}
 */

// `any` is required here since migrations should be frozen in time. alternatively, keep a "snapshot" db interface.
export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .createTable("material_subtypes")
    .addColumn("id", "bigint", (col) => col.autoIncrement().primaryKey())
    .addColumn("name", "varchar(255)", (col) => col.notNull())
    .$call(addAuditColumns)
    .$call(addTimestampColumns)
    .execute()
}

// `any` is required here since migrations should be frozen in time. alternatively, keep a "snapshot" db interface.
export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.dropTable("material_subtypes").execute()
}
