import { type Kysely } from "kysely"
import { addAuditColumns, addTimestampColumns } from "../helper.js"
import { Database } from "../types/index.js"

/**
 * 
 * @param db 
 * Table material_subtype_relations {
  id bigint [pk, increment]
  from_material_subtype_id bigint [not null]
  to_material_subtype_id bigint [not null]
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
    .createTable("material_subtype_relations")
    .addColumn("id", "bigint", (col) => col.autoIncrement().primaryKey())
    .addColumn("from_naterial_subtype_id", "bigint", (col) => col.notNull())
    .addColumn("to_naterial_subtype_id", "bigint", (col) => col.notNull())
    .$call(addAuditColumns)
    .$call(addTimestampColumns)
    .execute()
}

// `any` is required here since migrations should be frozen in time. alternatively, keep a "snapshot" db interface.
export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.dropTable("material_subtype_relations").execute()
}
