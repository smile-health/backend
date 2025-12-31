import { Kysely, sql } from "kysely"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await sql`ALTER TABLE ws_patient_medical_histories MODIFY id BIGINT AUTO_INCREMENT`.execute(
    db
  )
}

export async function down(db: Kysely<Database>): Promise<void> {
  await sql`ALTER TABLE ws_patient_medical_histories MODIFY id BIGINT`.execute(
    db
  )
}
