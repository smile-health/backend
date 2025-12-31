import { Kysely, sql } from "kysely"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  // await sql`
  //   CREATE INDEX idx_entities_locations ON entities (
  //     province_id(5),
  //     regency_id(6),
  //     sub_district_id(7),
  //     village_id(11)
  //   )
  // `.execute(db)
}

export async function down(db: Kysely<Database>): Promise<void> {
  // await db.schema.dropIndex("idx_entities_locations").execute()
}
