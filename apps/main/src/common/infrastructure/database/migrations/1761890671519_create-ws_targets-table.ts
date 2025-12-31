import { Kysely } from "kysely"
import { Database } from "../types/index.js"
import { addAuditColumns, addTimestampColumns } from "../helper.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .createTable("ws_targets")
    .addColumn("id", "bigint", (col) => col.autoIncrement().primaryKey())
    .addColumn("nik", "varchar(255)", (col) => col.notNull().unique())
    .addColumn("gender", "smallint", (col) => col.notNull())
    .addColumn("date_of_birth", "varchar(255)", (col) => col.notNull())
    .addColumn("registered_province_id", "bigint", (col) => col.notNull())
    .addColumn("registered_regency_id", "bigint", (col) => col.notNull())
    .addColumn("registered_subdistrict_id", "bigint", (col) => col.notNull())
    .addColumn("registered_village_id", "bigint", (col) => col.notNull())
    .addColumn("registered_postal_code", "bigint")
    .addColumn("residence_province_id", "bigint", (col) => col.notNull())
    .addColumn("residence_regency_id", "bigint", (col) => col.notNull())
    .addColumn("residence_subdistrict_id", "bigint", (col) => col.notNull())
    .addColumn("residence_village_id", "bigint", (col) => col.notNull())
    .addColumn("residence_postal_code", "bigint")
    .addColumn("entity_id", "bigint")
    .addColumn("grade", "smallint")
    .addColumn("target_group_id", "integer")
    .$call(addAuditColumns)
    .$call(addTimestampColumns)
    .execute()

  await db.schema
    .createIndex("idx_ws_targets_nik")
    .on("ws_targets")
    .column("nik")
    .execute()

  await db.schema
    .createIndex("idx_ws_targets_entity_id")
    .on("ws_targets")
    .column("entity_id")
    .execute()

  await db.schema
    .createIndex("idx_ws_targets_registered_village_id")
    .on("ws_targets")
    .column("registered_village_id")
    .execute()

  await db.schema
    .createIndex("idx_ws_targets_residence_village_id")
    .on("ws_targets")
    .column("residence_village_id")
    .execute()

  await db.schema
    .createIndex("idx_ws_targets_deleted_at")
    .on("ws_targets")
    .column("deleted_at")
    .execute()

  await db.schema
    .createIndex("idx_ws_targets_target_group_id")
    .on("ws_targets")
    .column("target_group_id")
    .execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.dropTable("ws_targets").execute()
}
