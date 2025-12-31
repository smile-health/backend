import { Kysely, sql } from "kysely"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  // await db.transaction().execute(async (trx) => {
  //   await sql`
  //     ALTER TABLE ws_patients
  //     MODIFY COLUMN nik VARCHAR(255) NOT NULL,
  //     ADD CONSTRAINT ws_patients_nik_unique UNIQUE (nik)
  //   `.execute(trx)
  // })
}

export async function down(db: Kysely<Database>): Promise<void> {
  // await db.transaction().execute(async (trx) => {
  //   await sql`
  //     ALTER TABLE ws_patients
  //     DROP CONSTRAINT ws_patients_nik_unique,
  //     MODIFY COLUMN nik VARCHAR(255) NULL
  //   `.execute(trx)
  // })
}
