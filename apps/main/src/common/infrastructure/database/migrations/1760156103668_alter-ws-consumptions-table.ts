import { Kysely, sql } from "kysely"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await sql`
    ALTER TABLE ws_consumptions
    DROP COLUMN protocol,
    CHANGE COLUMN vaccine_method vaccine_method_id SMALLINT,
    ADD COLUMN protocol_id BIGINT AFTER patient_id,
    ADD COLUMN vaccine_type_id INT NOT NULL AFTER vaccine_method_id
  `.execute(db)
}

export async function down(db: Kysely<Database>): Promise<void> {
  await sql`
    ALTER TABLE ws_consumptions
    DROP COLUMN protocol_id,
    DROP COLUMN vaccine_type_id,
    ADD COLUMN protocol BIGINT AFTER patient_id,
    CHANGE COLUMN vaccine_method_id vaccine_method SMALLINT;
  `.execute(db)
}
