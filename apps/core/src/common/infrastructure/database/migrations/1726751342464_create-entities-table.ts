import { sql, type Kysely } from "kysely"
import { Database } from "../types/index.js"
import { addTimestampColumns } from "../helper.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .createTable("entities")
    .addColumn("id", "bigint", (col) => col.autoIncrement().primaryKey())
    .addColumn("code", "varchar(255)")
    .addColumn("name", "varchar(255)")
    .addColumn("type", "smallint", (col) => col.notNull().defaultTo(1))
    .addColumn("status", "smallint", (col) => col.notNull().defaultTo(1))
    .addColumn("entity_tag_id", "bigint")
    .addColumn("address", "text")
    .addColumn("country", "varchar(255)")
    .addColumn("province_id", "varchar(255)")
    .addColumn("regency_id", "varchar(255)")
    .addColumn("sub_district_id", "varchar(255)")
    .addColumn("village_id", "varchar(255)")
    .addColumn("postal_code", "varchar(255)")
    .addColumn("lat", "varchar(255)")
    .addColumn("lng", "varchar(255)")
    .addColumn("is_puskesmas", "smallint", (col) => col.notNull().defaultTo(0))
    .addColumn("is_vendor", "smallint", (col) => col.notNull().defaultTo(0))
    .addColumn("id_satu_sehat", "bigint")
    .addColumn("created_by", "bigint")
    .addColumn("updated_by", "bigint")
    .$call(addTimestampColumns)
    .execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.dropTable("entities").execute()
}
