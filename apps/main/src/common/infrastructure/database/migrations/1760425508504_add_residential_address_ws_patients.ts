import { Kysely, sql } from "kysely"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await sql`
    ALTER TABLE ws_patients
    MODIFY COLUMN residential_address VARCHAR(255) AFTER rw,
    ADD COLUMN residential_province_id BIGINT AFTER residential_address,
    ADD COLUMN residential_regency_id BIGINT AFTER residential_province_id,
    ADD COLUMN residential_subdistrict_id BIGINT AFTER residential_regency_id,
    ADD COLUMN residential_village_id BIGINT AFTER residential_subdistrict_id;
  `.execute(db)
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema
    .alterTable("ws_patients")
    .dropColumn("residential_province_id")
    .dropColumn("residential_regency_id")
    .dropColumn("residential_subdistrict_id")
    .dropColumn("residential_village_id")
    .execute()

  await sql`
    ALTER TABLE ws_patients
    MODIFY COLUMN residential_address VARCHAR(255) AFTER address;
  `.execute(db)
}
