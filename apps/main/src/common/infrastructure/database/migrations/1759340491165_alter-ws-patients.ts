import { Kysely, sql } from "kysely"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .alterTable("ws_patients")
    .dropColumn("vaccine_sequence")
    .dropColumn("last_vaccine_at")
    .dropColumn("preexposure_sequence")
    .dropColumn("last_preexposure_at")
    .dropColumn("vaccine_method")
    .execute()

  await sql`
    ALTER TABLE ws_patients
    ADD COLUMN name VARCHAR(255) AFTER nik,
    ADD COLUMN gender SMALLINT NOT NULL DEFAULT 0 AFTER name,
    ADD COLUMN birth_date DATE AFTER gender,
    ADD COLUMN marital_status SMALLINT NOT NULL DEFAULT 0 AFTER birth_date,
    ADD COLUMN education_id BIGINT AFTER marital_status,
    ADD COLUMN occupation_id BIGINT AFTER education_id,
    ADD COLUMN religion_id BIGINT AFTER occupation_id,
    ADD COLUMN ethnic_id BIGINT AFTER religion_id,
    ADD COLUMN address VARCHAR(255) AFTER phone_number,
    ADD COLUMN residential_address VARCHAR(255) AFTER address,
    ADD COLUMN province_id BIGINT AFTER residential_address,
    ADD COLUMN regency_id BIGINT AFTER province_id,
    ADD COLUMN subdistrict_id BIGINT AFTER regency_id,
    ADD COLUMN village_id BIGINT AFTER subdistrict_id,
    ADD COLUMN pos_code VARCHAR(255) AFTER village_id,
    ADD COLUMN rt VARCHAR(255) AFTER pos_code,
    ADD COLUMN rw VARCHAR(255) AFTER rt;
  `.execute(db)

  await sql`
    ALTER TABLE ws_patients
    MODIFY COLUMN identity_type SMALLINT AFTER ethnic_id,
    MODIFY COLUMN stop_notification SMALLINT AFTER rw;
  `.execute(db)
}

export async function down(db: Kysely<Database>): Promise<void> {
  await sql`
    ALTER TABLE ws_patients
    MODIFY COLUMN stop_notification SMALLINT AFTER last_preexposure_at,
    MODIFY COLUMN identity_type SMALLINT AFTER entity_id;
  `.execute(db)

  await db.schema
    .alterTable("ws_patients")
    .dropColumn("name")
    .dropColumn("gender")
    .dropColumn("birth_date")
    .dropColumn("marital_status")
    .dropColumn("education_id")
    .dropColumn("occupation_id")
    .dropColumn("religion_id")
    .dropColumn("ethnic_id")
    .dropColumn("address")
    .dropColumn("residential_address")
    .dropColumn("province_id")
    .dropColumn("regency_id")
    .dropColumn("subdistrict_id")
    .dropColumn("village_id")
    .dropColumn("pos_code")
    .dropColumn("rt")
    .dropColumn("rw")
    .execute()

  await db.schema
    .alterTable("ws_patients")
    .addColumn("vaccine_sequence", "smallint")
    .addColumn("last_vaccine_at", "datetime")
    .addColumn("preexposure_sequence", "smallint")
    .addColumn("last_preexposure_at", "datetime")
    .addColumn("vaccine_method", "smallint")
    .execute()
}
