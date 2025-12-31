import type { Kysely } from "kysely"
import { addAuditColumns, addTimestampColumns } from "../helper"

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable("material_volumes")
    .addColumn("id", "bigint", (col) => col.primaryKey().autoIncrement())
    .addColumn("material_id", "bigint", (col) => col.notNull())
    .addColumn("manufacture_id", "bigint", (col) => col.notNull())
    .addColumn("box_length", "double precision", (col) => col.notNull())
    .addColumn("box_width", "double precision", (col) => col.notNull())
    .addColumn("box_height", "double precision", (col) => col.notNull())
    .addColumn("unit_per_box", "double precision", (col) => col.notNull())
    .$call(addTimestampColumns)
    .$call(addAuditColumns)
    .execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable("material_volumes").execute()
}
